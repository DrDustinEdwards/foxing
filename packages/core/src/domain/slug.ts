// The URL slug of a club, list or diary entry: Prelum's slugify (the family's one slug rule, accents folded) cut to 60
// characters, then a random suffix so two of the same name never collide without a retry loop. The suffix uses
// a-z and 0-9 only: nanoid's own alphabet has "_" and "-", which put "_" or "--" into a URL.
import { slugify } from "@drdustinedwards/site-helpers/slug";
import { customAlphabet } from "nanoid";

const suffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

export function uniqueSlug(text: string, fallback: string): string {
  return `${slugify(text, { max: 60 }) || fallback}-${suffix()}`;
}
