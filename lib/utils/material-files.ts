/** File types OneDrive listings offer as study materials. */
const MATERIAL_MIME_FRAGMENTS = ["pdf", "document", "spreadsheet", "presentation", "text"]
// Exact match: a "zip" fragment would also let in application/gzip
const ZIP_MIME_TYPES = new Set(["application/zip", "application/x-zip-compressed"])
const MATERIAL_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|pod|zip)$/i

export function isMaterialFile(item: { name: string; file?: { mimeType?: string } }): boolean {
  if (!item.file) return false
  const mimeType = item.file.mimeType
  return (
    (!!mimeType &&
      (ZIP_MIME_TYPES.has(mimeType) || MATERIAL_MIME_FRAGMENTS.some((fragment) => mimeType.includes(fragment)))) ||
    MATERIAL_EXTENSIONS.test(item.name)
  )
}
