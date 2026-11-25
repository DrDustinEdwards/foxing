export function clampPageSize(requested: number | undefined, max: number, fallback: number) {
  return Math.min(max, Math.max(1, requested ?? fallback));
}
