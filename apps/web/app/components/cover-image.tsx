import { cn } from "~/lib/cn";
import { coverAttributes } from "~/lib/images";
import { Picture } from "./picture";

type Props = {
  src: string | null | undefined;
  alt: string;
  /** The book/list title, drawn into the placeholder when there is no cover. */
  fallbackLabel?: string;
  /** Only the page's LCP image: eager + high priority. Everything else lazy. */
  priority?: boolean;
  /** Above the fold but not the LCP: loads at once, at normal priority. */
  eager?: boolean;
  /** coverThumb for covers shown at 80px or less. */
  use?: "cover" | "coverThumb";
  sizes?: string;
  className?: string;
};

/**
 * Book cover in a no-CLS 2:3 aspect box, as a `<picture>` of AVIF and WebP sizes (lib/images.ts),
 * and a typographic placeholder when a cover is missing (community-book covers, per the deferred
 * Stage 3 backfill).
 */
export function CoverImage({
  src,
  alt,
  fallbackLabel,
  priority,
  eager,
  use,
  sizes,
  className,
}: Props) {
  return (
    <div className={cn("cover-img", className)}>
      {src ? (
        <CoverPicture
          src={src}
          alt={alt}
          use={use}
          sizes={sizes}
          priority={priority}
          eager={eager}
          className="cover-img-photo"
        />
      ) : (
        <div className="cover-img-fallback">
          <span>{fallbackLabel ?? alt}</span>
        </div>
      )}
    </div>
  );
}

/** A cover's `<picture>` alone, for a page that draws its own box. */
export function CoverPicture({
  src,
  use,
  sizes,
  ...rest
}: Omit<React.ComponentProps<typeof Picture>, "attrs"> & {
  src: string;
  use?: "cover" | "coverThumb";
  sizes?: string;
}) {
  return <Picture attrs={coverAttributes(src, { use, sizes })} {...rest} />;
}
