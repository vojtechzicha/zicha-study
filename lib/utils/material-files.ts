/** File types OneDrive listings offer as study materials. */
const MATERIAL_MIME_FRAGMENTS = ["pdf", "document", "spreadsheet", "presentation", "text", "zip"]
const MATERIAL_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|pod|zip)$/i

export function isMaterialFile(item: { name: string; file?: { mimeType?: string } }): boolean {
  if (!item.file) return false
  const mimeType = item.file.mimeType
  return (
    (!!mimeType && MATERIAL_MIME_FRAGMENTS.some((fragment) => mimeType.includes(fragment))) ||
    MATERIAL_EXTENSIONS.test(item.name)
  )
}
