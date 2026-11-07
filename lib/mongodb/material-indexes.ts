import { FILE_ONLY_FIELDS } from "@/lib/utils/material-link"

// A unique index over a OneDrive-only field (e.g. onedrive_id) treats a missing field as null, so the
// second link material in its scope collides with the first. Such indexes only make sense for files:
// they are replaced by partial indexes that apply only when every OneDrive-only key exists. Link
// materials never store those fields (prepareMaterialData strips them), whatever their stored type.

export interface ExistingIndex {
  name: string
  key: Record<string, unknown>
  unique?: boolean
  partialFilterExpression?: Record<string, unknown>
  [option: string]: unknown
}

export interface IndexRebuild {
  /** The existing index, dropped once its replacement exists. */
  name: string
  /** The partial replacement, created first so the files never go without a unique index. */
  replacementName: string
  key: Record<string, unknown>
  partialFilterExpression: Record<string, unknown>
}

const fileOnly = new Set<string>(FILE_ONLY_FIELDS)

export function planMaterialIndexRebuilds(indexes: ExistingIndex[]): IndexRebuild[] {
  return indexes.flatMap((index) => {
    if (!index.unique || index.partialFilterExpression || index.name === "_id_") return []
    const fileKeys = Object.keys(index.key).filter((field) => fileOnly.has(field))
    if (fileKeys.length === 0) return []
    const partialFilterExpression = Object.fromEntries(fileKeys.map((field) => [field, { $exists: true }]))
    return [{ name: index.name, replacementName: `${index.name}_files`, key: index.key, partialFilterExpression }]
  })
}
