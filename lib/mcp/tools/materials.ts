import { z } from "zod"
import * as db from "@/lib/mongodb/db"
import { MATERIAL_CATEGORIES, MATERIAL_TYPES, getMaterialType } from "@/lib/constants"
import { dryRun, emptyToNull, enumOf, optionalText, publicSlug, recordId, requireFields, text } from "@/lib/mcp/schemas"
import { ToolError, commitCreate, commitDelete, commitUpdate, defineTool, requireDoc } from "@/lib/mcp/tool-kit"
import { normalizeLinkUrl, prepareMaterialData } from "@/lib/utils/material-link"

// Materials are OneDrive files or links (e.g. a shared group project). Links are fully
// manageable here. Files only get their metadata edited: adding, publishing and deleting
// them needs OneDrive (share links, backup copies), so that stays in the app.

const materialFields = z
  .object({
    name: text(200),
    link_url: z.string().trim().max(2000).describe("http(s) address of a link material; a missing scheme becomes https://."),
    description: optionalText(2000),
    category: enumOf(MATERIAL_CATEGORIES).nullable(),
    is_public: z.boolean().describe("Publish the material on the study's public page; its address then redirects to the link."),
    public_slug: publicSlug.nullable().describe("Public address; required when is_public is true."),
  })
  .partial()
  .strict()

type MaterialFields = z.infer<typeof materialFields>

// Study materials and subject materials live in separate collections; ids are unique across both.
interface Located {
  doc: Record<string, any>
  collection: "materials" | "subject_materials"
}

async function requireMaterial(materialId: string): Promise<Located> {
  const studyMaterial = await db.getMaterialById(materialId)
  if (studyMaterial) return { doc: studyMaterial, collection: "materials" }
  const subjectMaterial = await db.getSubjectMaterialById(materialId)
  if (subjectMaterial) return { doc: subjectMaterial, collection: "subject_materials" }
  throw new ToolError(`Material ${materialId} not found.`)
}

const isLink = (doc: Record<string, any>) => getMaterialType(doc) === MATERIAL_TYPES.LINK

// material: a normalized record (id instead of _id)
function summary(material: Record<string, any>) {
  const base = {
    id: material.id,
    material_type: getMaterialType(material),
    study_id: material.study_id,
    subject_id: material.subject_id ?? null,
    name: material.name,
    description: material.description ?? null,
    category: material.category ?? null,
    is_public: !!material.is_public,
    public_slug: material.public_slug ?? null,
    created_at: material.created_at,
  }
  return isLink(material)
    ? { ...base, link_url: material.link_url }
    : { ...base, file_name: material.file_name ?? null, file_size: material.file_size ?? null, onedrive_web_url: material.onedrive_web_url ?? null }
}

function slugAvailable(collection: Located["collection"], studyId: string, slug: string, excludeId?: string) {
  return collection === "materials"
    ? db.checkMaterialSlugAvailability(studyId, slug, excludeId)
    : db.checkSubjectMaterialSlugAvailability(studyId, slug, excludeId)
}

// Same rules as the app: only http(s) links, publishing only in a public study, free addresses.
async function prepareMaterialPatch(
  collection: Located["collection"],
  before: Record<string, any> | null,
  studyId: string,
  fields: MaterialFields,
  link: boolean
) {
  const patch: Record<string, any> = emptyToNull(fields)

  if ("link_url" in patch) {
    if (!link) throw new ToolError("Only link materials have link_url; files live on OneDrive.")
    const url = normalizeLinkUrl(patch.link_url)
    if (!url) throw new ToolError("link_url must be an http(s) address, e.g. https://figma.com/file/….")
    patch.link_url = url
  }

  if ("is_public" in patch || "public_slug" in patch) {
    const isPublic = patch.is_public ?? !!before?.is_public
    if (!isPublic) {
      if (patch.public_slug) throw new ToolError("Set is_public to true to give the material a public address.")
      patch.is_public = false
      patch.public_slug = null
      if (!link) patch.public_share_url = null
    } else {
      if (!link && !before?.is_public) {
        throw new ToolError("Publishing a OneDrive file needs a OneDrive share link; publish it in the app.")
      }
      const study = requireDoc(await db.getStudyById(studyId), "Study", studyId)
      if (!study.is_public) throw new ToolError("The study isn't public; publish it with update_study first.")
      const slug = patch.public_slug === undefined ? before?.public_slug : patch.public_slug
      if (!slug) throw new ToolError("A public material needs public_slug.")
      if (slug !== before?.public_slug && !(await slugAvailable(collection, studyId, slug, before?._id))) {
        throw new ToolError(`The address „${slug}“ is taken in this study.`)
      }
      patch.is_public = true
      patch.public_slug = slug
    }
  }

  return link ? prepareMaterialData({ ...patch, material_type: MATERIAL_TYPES.LINK, link_url: patch.link_url ?? before?.link_url }) : patch
}

export const materialTools = [
  defineTool({
    name: "list_materials",
    title: "List materials",
    description:
      "Materials of a study: OneDrive files and links. Without subject_id: the study's own materials and those of all its subjects (subject_id tells them apart). With subject_id: that subject's materials.",
    access: "read",
    input: { study_id: recordId, subject_id: recordId.optional() },
    handler: async ({ study_id, subject_id }) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      if (subject_id) {
        const subject = requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)
        if (subject.study_id !== study_id) throw new ToolError("The subject belongs to a different study.")
        // A repeated subject shows the materials of its first attempt, like in the app.
        const rootId = await db.getRepeatRootId(subject_id)
        return (await db.getSubjectMaterialsBySubjectId(rootId)).map((doc) => summary(db.normalizeId(doc)!))
      }
      const [studyMaterials, subjectMaterials] = await Promise.all([
        db.getMaterialsByStudyId(study_id),
        db.getSubjectMaterialsByStudyId(study_id),
      ])
      return [...studyMaterials, ...subjectMaterials].map((doc) => summary(db.normalizeId(doc)!))
    },
  }),

  defineTool({
    name: "create_link_material",
    title: "Create link material",
    description:
      "Add a link (e.g. a shared group project, a Figma board, a repository) as a material of a study, or of one of its subjects with subject_id. Needs name and link_url. OneDrive files are added in the app.",
    access: "write",
    input: { study_id: recordId, subject_id: recordId.optional(), fields: materialFields },
    handler: async ({ study_id, subject_id, fields }, ctx) => {
      requireDoc(await db.getStudyById(study_id), "Study", study_id)
      requireFields(fields, ["name", "link_url"], "A link material")

      let rootSubjectId: string | null = null
      if (subject_id) {
        const subject = requireDoc(await db.getSubjectById(subject_id), "Subject", subject_id)
        if (subject.study_id !== study_id) throw new ToolError("The subject belongs to a different study.")
        rootSubjectId = await db.getRepeatRootId(subject_id)
      }

      const collection = rootSubjectId ? "subject_materials" : "materials"
      const patch = await prepareMaterialPatch(collection, null, study_id, fields, true)
      const data = {
        study_id,
        description: null,
        category: null,
        is_public: false,
        public_slug: null,
        ...patch,
        ...(rootSubjectId ? { subject_id: rootSubjectId } : {}),
      }
      const result = await commitCreate({ ctx, tool: "create_link_material", collection }, () =>
        rootSubjectId ? db.createSubjectMaterial(data) : db.createMaterial(data)
      )
      return { created: summary(result.created) }
    },
  }),

  defineTool({
    name: "update_material",
    title: "Update material",
    description:
      "Rename a material, change its description or category, change a link's address, or publish/unpublish a link. OneDrive files can be unpublished here but are published in the app. Only the given fields change; null clears a field.",
    access: "write",
    input: { material_id: recordId, fields: materialFields, dry_run: dryRun },
    handler: async ({ material_id, fields, dry_run }, ctx) => {
      const { doc: before, collection } = await requireMaterial(material_id)
      const link = isLink(before)
      const patch = await prepareMaterialPatch(collection, before, before.study_id, fields, link)
      return commitUpdate({
        ctx,
        tool: "update_material",
        collection,
        before,
        patch,
        dryRun: dry_run,
        write: (p) =>
          collection === "materials" ? db.updateMaterial(material_id, p) : db.updateSubjectMaterial(material_id, p),
        reload: () => (collection === "materials" ? db.getMaterialById(material_id) : db.getSubjectMaterialById(material_id)),
      })
    },
  }),

  defineTool({
    name: "delete_material",
    title: "Delete material",
    description: "Permanently delete a link material. OneDrive files have backup copies on OneDrive and are deleted in the app.",
    access: "delete",
    input: { material_id: recordId, dry_run: dryRun },
    handler: async ({ material_id, dry_run }, ctx) => {
      const { doc: before, collection } = await requireMaterial(material_id)
      if (!isLink(before)) throw new ToolError("This material is a OneDrive file; delete it in the app so its backup copy goes too.")
      return commitDelete({
        ctx,
        tool: "delete_material",
        collection,
        before,
        dryRun: dry_run,
        remove: () =>
          collection === "materials" ? db.deleteMaterial(material_id) : db.deleteSubjectMaterial(material_id),
      })
    },
  }),
]
