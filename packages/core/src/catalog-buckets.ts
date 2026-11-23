// Era and length buckets for the browse and search filters, shared by the catalog queries and the web filter UI.
export type Bucket = { slug: string; label: string; min: number; max: number };

export const ERA_BUCKETS: Bucket[] = [
  { slug: "pre-1800", label: "Before 1800", min: -4000, max: 1799 },
  { slug: "1800-1849", label: "1800 to 1849", min: 1800, max: 1849 },
  { slug: "1850-1899", label: "1850 to 1899", min: 1850, max: 1899 },
  { slug: "1900-1949", label: "1900 to 1949", min: 1900, max: 1949 },
  { slug: "modern", label: "1950 and later", min: 1950, max: 3000 },
];

export const LENGTH_BUCKETS: Bucket[] = [
  { slug: "short", label: "Short, under 40k words", min: 0, max: 39_999 },
  { slug: "medium", label: "Medium, 40k to 120k", min: 40_000, max: 120_000 },
  { slug: "long", label: "Long, 120k and up", min: 120_001, max: 100_000_000 },
];
