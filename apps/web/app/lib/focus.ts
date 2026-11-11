import {
  type ImageAttributes,
  type PictureProps,
  pictureProps,
} from "@dustinedwards/site-runtime/image";

// A cover's focal point, as Carrel sets it on a Journal media file ("XxY", each 0 to 1 from the
// top left), turned into the CSS that keeps it in view when the cover is cropped (object-fit: cover).
// No point, or one this site never wrote, leaves the browser's default, the middle.

export function focusStyle(
  focus: string | null | undefined,
): { objectPosition: string } | undefined {
  const point = focus ? /^([01](?:\.\d{1,3})?)x([01](?:\.\d{1,3})?)$/.exec(focus) : null;
  if (!point) return undefined;
  const percent = (n: string) => `${Math.round(Math.min(1, Number(n)) * 1000) / 10}%`;
  return { objectPosition: `${percent(point[1])} ${percent(point[2])}` };
}

/** A Journal cover's picture props (Capsomer's React Picture, `picture`) with its focal point on the image. */
export function focusedPicture(
  attrs: ImageAttributes,
  options: { alt: string; priority?: boolean; className?: string },
  focus: string | null | undefined,
): PictureProps {
  const props = pictureProps(attrs, options);
  const point = focusStyle(focus);
  if (!point) return props;
  const style = { ...props.img.style, ...point } as unknown as PictureProps["img"]["style"];
  return { ...props, img: { ...props.img, style } };
}
