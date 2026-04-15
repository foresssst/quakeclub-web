/**
 * Utility functions for generating URL-friendly slugs
 */

/**
 * Convert a string to a URL-friendly slug
 * Example: "Liga DPR Clan Arena | Season #2" -> "liga-dpr-clan-arena-season-2"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')                     // Normalize unicode (á -> a + combining accent)
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics (accents)
    .replace(/[^a-z0-9\s-]/g, '')        // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-')                 // Replace spaces with hyphens
    .replace(/-+/g, '-')                  // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')              // Remove leading/trailing hyphens
    .substring(0, 100)                    // Limit length
}

/**
 * Generate a unique slug by appending a number if needed
 * @param baseSlug The base slug to start with
 * @param existingSlugs Array of existing slugs to check against
 * @returns A unique slug
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug
  let counter = 1
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}

/**
 * Generate a slug from a news title with timestamp suffix for uniqueness
 * Example: "Gran Final de la Copa" with id "news-1761531170475" -> "gran-final-de-la-copa"
 */
export function generateNewsSlug(title: string, existingSlugs: string[] = []): string {
  const baseSlug = generateSlug(title)
  return generateUniqueSlug(baseSlug, existingSlugs)
}

/**
 * Generate a slug from a tournament name
 * Example: "Liga DPR Clan Arena | Season #2" -> "liga-dpr-clan-arena-season-2"
 */
export function generateTournamentSlug(name: string): string {
  return generateSlug(name)
}

/**
 * Generate a clan slug using underscores instead of hyphens
 * Example: "Revenge Squad" -> "revenge_squad"
 *          "LAPESKÁ" -> "lapeska"  
 *          "Panzer Death Squad" -> "panzer_death_squad"
 */
export function generateClanSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '')         // Remove special characters except spaces
    .replace(/\s+/g, '_')                 // Replace spaces with underscores
    .replace(/_+/g, '_')                  // Replace multiple underscores with single
    .replace(/^_|_$/g, '')                // Remove leading/trailing underscores
    .substring(0, 50)                     // Limit length
    || 'clan'                             // Fallback if empty
}

/**
 * Generate a unique clan slug
 */
export async function generateUniqueClanSlug(
  name: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateClanSlug(name)
  let slug = baseSlug
  let counter = 1

  while (await checkExists(slug)) {
    slug = `${baseSlug}_${counter}`
    counter++
    if (counter > 100) {
      slug = `${baseSlug}_${Date.now()}`
      break
    }
  }

  return slug
}
