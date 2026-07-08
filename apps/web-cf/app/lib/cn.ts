// Minimal class combiner. No tailwind-merge: we do not fight ourselves with
// conflicting utilities, so a filtered join is enough and ships zero runtime cost.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
