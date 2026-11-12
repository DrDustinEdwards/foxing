/** A requested page size kept between 1 and `max`; `fallback` when none was asked for. */
export function clampPageSize(requested: number | undefined, max: number, fallback: number) {
  return Math.min(max, Math.max(1, requested ?? fallback));
}
