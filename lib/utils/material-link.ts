import { MATERIAL_TYPES, getMaterialType } from "@/lib/constants"

/**
 * Turns user input into an absolute http(s) address, or null when it isn't one.
 * A missing scheme means https ("figma.com/file/…" → "https://figma.com/file/…").
 * Anything else (javascript:, mailto:, data:) is refused: link materials end up
 * in href attributes and in the public page's redirect.
 */
export function normalizeLinkUrl(input: string | null | undefined): string | null {
  const trimmed = input?.trim()
  if (!trimmed) return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed.replace(/^\/+/, "")}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  // "https://foo" and similar typos: require a dot in the host (localhost excepted)
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null

  return url.toString()
}

/** Host shown under a link material's name: "www.figma.com" → "figma.com". */
export function getLinkHost(url: string | null | undefined): string {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// Fields that only make sense for a OneDrive file; link materials never store them
export const FILE_ONLY_FIELDS = [
  "file_name",
  "file_extension",
  "file_size",
  "mime_type",
  "onedrive_id",
  "onedrive_web_url",
  "onedrive_download_url",
  "parent_path",
  "last_modified_onedrive",
  "public_share_url",
  "cache_onedrive_id",
  "cache_onedrive_web_url",
  "cache_public_share_url",
] as const

/**
 * Checks material data before it is stored. A link material must carry a valid
 * http(s) link_url (normalized here) and no OneDrive fields. Throws with a
 * Czech message the dialogs show as-is.
 */
export function prepareMaterialData<T extends Record<string, unknown>>(data: T): T {
  const touchesLink = "material_type" in data || "link_url" in data
  if (!touchesLink) return data

  if (getMaterialType(data as { material_type?: string | null }) !== MATERIAL_TYPES.LINK) {
    if (data.link_url != null) throw new Error("Odkaz může mít jen materiál typu odkaz.")
    return data
  }

  const linkUrl = normalizeLinkUrl(data.link_url as string | null | undefined)
  if (!linkUrl) throw new Error("Zadejte platný odkaz začínající http:// nebo https://.")

  const prepared: Record<string, unknown> = { ...data, material_type: MATERIAL_TYPES.LINK, link_url: linkUrl }
  for (const field of FILE_ONLY_FIELDS) delete prepared[field]
  return prepared as T
}

interface DisplayableMaterial {
  material_type?: string | null
  link_url?: string | null
  file_name?: string | null
  onedrive_web_url?: string | null
}

/** Where opening the material leads in the app: the link, or the file in OneDrive. */
export function getMaterialOpenUrl(material: DisplayableMaterial): string | undefined {
  if (getMaterialType(material) === MATERIAL_TYPES.LINK) return normalizeLinkUrl(material.link_url) ?? undefined
  return material.onedrive_web_url || undefined
}

/** Second line under the material's name: the link's host, or the file name. */
export function getMaterialSubtitle(material: DisplayableMaterial): string {
  if (getMaterialType(material) === MATERIAL_TYPES.LINK) return getLinkHost(material.link_url)
  return material.file_name || ""
}

/** Label of the "open" action. */
export function getMaterialOpenLabel(material: DisplayableMaterial): string {
  return getMaterialType(material) === MATERIAL_TYPES.LINK ? "Otevřít odkaz" : "Otevřít v OneDrive"
}
