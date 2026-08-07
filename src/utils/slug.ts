/**
 * Generate a URL-safe slug from a center name.
 *
 * Steps:
 * 1. Lowercase the input
 * 2. Remove non-alphanumeric characters (except spaces and hyphens)
 * 3. Replace spaces with hyphens
 * 4. Collapse consecutive hyphens into one
 * 5. Trim leading/trailing hyphens
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validate a slug string.
 *
 * Rules:
 * - 3–50 characters
 * - Only lowercase letters, numbers, and hyphens [a-z0-9-]
 * - Must start and end with an alphanumeric character
 * - No consecutive hyphens (--)
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (slug.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }

  if (slug.length > 50) {
    return { valid: false, error: 'Slug must be at most 50 characters' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }

  if (!/^[a-z0-9]/.test(slug)) {
    return { valid: false, error: 'Slug must start with a lowercase letter or number' };
  }

  if (!/[a-z0-9]$/.test(slug)) {
    return { valid: false, error: 'Slug must end with a lowercase letter or number' };
  }

  if (/--/.test(slug)) {
    return { valid: false, error: 'Slug must not contain consecutive hyphens' };
  }

  return { valid: true };
}
