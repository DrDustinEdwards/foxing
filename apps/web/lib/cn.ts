/**
 * Tiny class-name joiner. Filters out falsy values and joins with spaces.
 * No external dependency; clsx and tailwind-merge are not needed at this
 * scale and we want the bundle clean.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(' ')
}
