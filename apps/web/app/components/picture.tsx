import { type ImageAttributes, pictureProps } from "@dustinedwards/site-runtime/image";

/** A `<picture>` for site-runtime's image attributes (lib/images.ts): AVIF and WebP sizes, lazy unless `priority`. */
export function Picture({
  attrs,
  alt,
  priority,
  eager,
  className,
  style,
}: {
  attrs: ImageAttributes;
  alt: string;
  /** Only the page's LCP image. */
  priority?: boolean;
  /** Above the fold but not the LCP (the rest of a grid's first row): loads at once, at normal priority. */
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { sources, img } = pictureProps(attrs, { alt, priority, className });
  return (
    <picture>
      {sources.map((s) => (
        <source key={s.media ? `${s.type} still` : s.type} {...s} />
      ))}
      <img
        {...img}
        alt={alt}
        style={style ? { ...img.style, ...style } : img.style}
        loading={eager && !priority ? "eager" : img.loading}
      />
    </picture>
  );
}
