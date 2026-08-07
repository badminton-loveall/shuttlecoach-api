import * as fc from 'fast-check';
import { validateSlug } from '../slug';

/**
 * Property 1: Slug validation correctly classifies inputs
 *
 * Validates: Requirements 1.2, 7.2
 *
 * The validateSlug function should return valid: true if and only if:
 * - Length is 3–50
 * - Only contains [a-z0-9-]
 * - Starts and ends with [a-z0-9]
 * - No consecutive hyphens (--)
 */

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-'.split('');

/** Reference implementation: returns true iff slug is valid per spec rules */
function isValidSlugByReference(s: string): boolean {
  if (s.length < 3 || s.length > 50) return false;
  if (/--/.test(s)) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s);
}

/** Arbitrary that generates strings from a given character set */
function stringFromChars(chars: string[], minLength: number, maxLength: number) {
  return fc.string({ unit: fc.constantFrom(...chars), minLength, maxLength });
}

describe('Property 1: Slug validation correctly classifies inputs', () => {
  /**
   * Validates: Requirements 1.2, 7.2
   */

  it('valid slugs are classified as valid', () => {
    // Generator: produce strings that are guaranteed valid slugs
    // Strategy: alphanumeric start + middle (no consecutive hyphens) + alphanumeric end
    const validSlugArb = fc
      .tuple(
        fc.constantFrom(...ALPHANUMERIC), // first char
        fc.array(fc.constantFrom(...SLUG_CHARS), { minLength: 1, maxLength: 48 }), // middle
        fc.constantFrom(...ALPHANUMERIC) // last char
      )
      .map(([first, middle, last]) => {
        // Remove consecutive hyphens from middle
        const cleaned: string[] = [];
        for (const c of middle) {
          if (c === '-' && cleaned.length > 0 && cleaned[cleaned.length - 1] === '-') continue;
          cleaned.push(c);
        }
        // Ensure last of middle is not a hyphen (since we append alphanumeric last)
        const slug = first + cleaned.join('') + last;
        return slug;
      })
      .filter((s) => s.length >= 3 && s.length <= 50 && isValidSlugByReference(s));

    fc.assert(
      fc.property(validSlugArb, (slug) => {
        const result = validateSlug(slug);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 200 }
    );
  });

  it('invalid slugs are classified as invalid', () => {
    const invalidSlugArb = fc
      .oneof(
        // Too short (1-2 chars)
        stringFromChars(ALPHANUMERIC, 1, 2),
        // Too long (51+ chars)
        stringFromChars(ALPHANUMERIC, 51, 60),
        // Contains uppercase
        fc.tuple(
          fc.constantFrom(...ALPHANUMERIC),
          fc.string({ unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), minLength: 1, maxLength: 5 }),
          fc.constantFrom(...ALPHANUMERIC)
        ).map(([first, mid, last]) => first + mid + last),
        // Starts with hyphen
        stringFromChars(ALPHANUMERIC, 2, 10).map((s: string) => '-' + s),
        // Ends with hyphen
        stringFromChars(ALPHANUMERIC, 2, 10).map((s: string) => s + '-'),
        // Contains consecutive hyphens
        fc.tuple(
          stringFromChars(ALPHANUMERIC, 1, 10),
          stringFromChars(ALPHANUMERIC, 1, 10)
        ).map(([a, b]) => a + '--' + b),
        // Contains special characters
        fc.tuple(
          fc.constantFrom(...ALPHANUMERIC),
          fc.string({ unit: fc.constantFrom(...'!@#$%^&*()_+=[]{}|;:,.<>?/~` '.split('')), minLength: 1, maxLength: 5 }),
          fc.constantFrom(...ALPHANUMERIC)
        ).map(([first, mid, last]) => first + mid + last)
      )
      .filter((s) => !isValidSlugByReference(s));

    fc.assert(
      fc.property(invalidSlugArb, (slug) => {
        const result = validateSlug(slug);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }),
      { numRuns: 200 }
    );
  });

  it('classification is consistent with the reference regex implementation', () => {
    // Generator: completely arbitrary strings including edge cases
    const arbitraryStringArb = fc.oneof(
      // Pure ASCII strings of varying lengths
      fc.string({ minLength: 0, maxLength: 60 }),
      // Strings composed of valid slug characters (higher chance of near-valid inputs)
      stringFromChars(SLUG_CHARS, 0, 60),
      // Empty string
      fc.constant('')
    );

    fc.assert(
      fc.property(arbitraryStringArb, (input) => {
        const result = validateSlug(input);
        const expected = isValidSlugByReference(input);
        expect(result.valid).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });
});
