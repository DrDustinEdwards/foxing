// A cover's focal point, as Carrel sets it on a Journal media file ("XxY", each 0 to 1 from the
// top left), turned into the CSS that keeps it in view when the cover is cropped (object-fit: cover).
// No point, or one this site never wrote, leaves the browser's centre.

export function focusStyle(
  focus: string | null | undefined,
): { objectPosition: string } | undefined {
  const point = focus ? /^([01](?:\.\d{1,3})?)x([01](?:\.\d{1,3})?)$/.exec(focus) : null;
  if (!point) return undefined;
  const percent = (n: string) => `${Math.round(Math.min(1, Number(n)) * 1000) / 10}%`;
  return { objectPosition: `${percent(point[1])} ${percent(point[2])}` };
}
