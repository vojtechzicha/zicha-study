/**
 * Normalizes Czech diacritics and creates a valid slug
 */
export function createSlug(text: string): string {
  // Czech diacritics mapping
  const czechMap: Record<string, string> = {
    'á': 'a', 'Á': 'a',
    'č': 'c', 'Č': 'c',
    'ď': 'd', 'Ď': 'd',
    'é': 'e', 'É': 'e',
    'ě': 'e', 'Ě': 'e',
    'í': 'i', 'Í': 'i',
    'ň': 'n', 'Ň': 'n',
    'ó': 'o', 'Ó': 'o',
    'ř': 'r', 'Ř': 'r',
    'š': 's', 'Š': 's',
    'ť': 't', 'Ť': 't',
    'ú': 'u', 'Ú': 'u',
    'ů': 'u', 'Ů': 'u',
    'ý': 'y', 'Ý': 'y',
    'ž': 'z', 'Ž': 'z'
  }
  
  // Replace Czech characters
  let normalized = text
  for (const [czech, latin] of Object.entries(czechMap)) {
    normalized = normalized.replace(new RegExp(czech, 'g'), latin)
  }
  
  // Convert to lowercase and clean up
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '') // Remove non-alphanumeric except spaces, hyphens, underscores
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .slice(0, 50)                  // Limit length
}

/**
 * Cleans an existing slug input (for real-time validation)
 */
export function cleanSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 50)
}