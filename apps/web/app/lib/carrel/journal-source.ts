// The one place a Journal row and Carrel's markdown file meet. Carrel edits a whole file: front
// matter for the row's fields, then the post's markdown body. Every field the file carries is listed
// in FIELDS; the slug is the content id and the published state is the row's status, so neither is
// in the file. Columns the file does not name (og_title, og_description, canonical_url, the
// show_* toggles, related_post_ids, reading_time_minutes) are never written through Carrel.
//
// Each front matter line is `key: value`, the value as JSON. A plain unquoted string is accepted
// for the text fields so a hand edit does not have to quote. A key the file leaves out is cleared,
// because the file is the whole post.

export type JournalFields = {
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  tags: string[];
  featured: boolean;
  content: string;
};

type FieldKind = "text" | "tags" | "flag";

/** Front matter key, the row field it maps to, and its kind, in the order the file lists them. */
const FIELDS = [
  ["title", "title", "text"],
  ["excerpt", "excerpt", "text"],
  ["cover_image_url", "coverImageUrl", "text"],
  ["cover_image_alt", "coverImageAlt", "text"],
  ["tags", "tags", "tags"],
  ["featured", "featured", "flag"],
] as const satisfies ReadonlyArray<
  readonly [string, Exclude<keyof JournalFields, "content">, FieldKind]
>;

/** The keys journal_post_versions keeps for an earlier version: the rest are not in history. */
export const HISTORY_KEYS = ["title", "excerpt"] as const;

export class JournalSourceError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `The file cannot be read as a Journal post:\n${problems.map((p) => `- ${p}`).join("\n")}`,
    );
    this.name = "JournalSourceError";
  }
}

/** Writes a row's fields as Carrel's file. `only` limits the front matter to those keys. */
export function journalToSource(fields: JournalFields, only?: ReadonlyArray<string>): string {
  const lines: string[] = [];
  for (const [key, field] of FIELDS) {
    if (only && !only.includes(key)) continue;
    lines.push(`${key}: ${JSON.stringify(fields[field])}`);
  }
  return `---\n${lines.join("\n")}\n---\n\n${fields.content}`;
}

function readText(key: string, raw: string, problems: string[]): string | null {
  if (raw === "" || raw === "null") return null;
  if (raw.startsWith('"')) {
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === "string") return value;
    } catch (error) {
      problems.push(`${key}: the quoted value is not valid (${(error as Error).message}).`);
      return null;
    }
  }
  return raw;
}

function readTags(raw: string, problems: string[]): string[] {
  if (raw === "" || raw === "null") return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    problems.push('tags: write a list, such as ["essays", "classics"].');
    return [];
  }
  if (!Array.isArray(value) || !value.every((t) => typeof t === "string")) {
    problems.push('tags: write a list of quoted words, such as ["essays", "classics"].');
    return [];
  }
  return value.map((t) => t.trim()).filter(Boolean);
}

function readFlag(raw: string, problems: string[]): boolean {
  if (raw === "" || raw === "false") return false;
  if (raw === "true") return true;
  problems.push("featured: write true or false.");
  return false;
}

/** Reads Carrel's file back into the row's fields, or throws JournalSourceError naming every problem. */
export function sourceToJournal(source: string): JournalFields {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source);
  if (!match) {
    throw new JournalSourceError([
      "The file must start with a front matter block between two --- lines, with at least a title.",
    ]);
  }
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const pair = /^([a-z_]+):[ \t]*(.*?)[ \t]*$/.exec(line);
    if (!pair) {
      problems.push(`This front matter line is not "key: value": ${line.slice(0, 80)}`);
      continue;
    }
    const [, key, value] = pair;
    if (!FIELDS.some(([k]) => k === key)) {
      problems.push(
        `${key} is not a Journal field. The fields are ${FIELDS.map(([k]) => k).join(", ")}.`,
      );
      continue;
    }
    if (seen.has(key)) {
      problems.push(`${key} appears twice.`);
      continue;
    }
    seen.set(key, value);
  }

  const read = (key: string) => seen.get(key) ?? "";
  const fields: JournalFields = {
    title: readText("title", read("title"), problems) ?? "",
    excerpt: readText("excerpt", read("excerpt"), problems),
    coverImageUrl: readText("cover_image_url", read("cover_image_url"), problems),
    coverImageAlt: readText("cover_image_alt", read("cover_image_alt"), problems),
    tags: readTags(read("tags"), problems),
    featured: readFlag(read("featured"), problems),
    // One blank line separates the front matter from the body; journalToSource writes it.
    content: source.slice(match[0].length).replace(/^\r?\n/, ""),
  };
  if (!fields.title.trim()) problems.push("title is required.");
  if (problems.length) throw new JournalSourceError(problems);
  return fields;
}
