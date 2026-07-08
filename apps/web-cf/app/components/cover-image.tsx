import { useState } from "react";
import { cn } from "~/lib/cn";
import { COVER_WIDTHS, coverPlaceholder, coverSrc, coverSrcSet } from "~/lib/images";

type Props = {
  src: string | null | undefined;
  alt: string;
  /** The book/list title, drawn into the placeholder when there is no cover. */
  fallbackLabel?: string;
  /** LCP cover on a detail page: eager + high priority. Everything else lazy. */
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/**
 * Book cover with Cloudflare Image Transformations (responsive srcset, AVIF/WebP,
 * blur-up LQIP) and a no-CLS 2:3 aspect box. Falls back to the raw R2 URL when
 * Transformations is disabled, and to a typographic placeholder when a cover is
 * missing (community-book covers, per the deferred Stage 3 backfill).
 */
export function CoverImage({ src, alt, fallbackLabel, priority, sizes, className }: Props) {
  const [loaded, setLoaded] = useState(false);
  const placeholder = src ? coverPlaceholder(src) : "";

  return (
    <div
      className={cn(
        "cover-img relative aspect-[2/3] overflow-hidden rounded-cover bg-sunken shadow-card-sm ring-1 ring-border-subtle",
        className,
      )}
      style={placeholder ? { backgroundImage: `url("${placeholder}")` } : undefined}
      data-loaded={loaded ? "true" : "false"}
    >
      {src ? (
        <img
          src={coverSrc(src, 400)}
          srcSet={coverSrcSet(src) || undefined}
          sizes={sizes ?? `(min-width: 768px) ${COVER_WIDTHS[3]}px, 45vw`}
          alt={alt}
          width={400}
          height={600}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding={priority ? "auto" : "async"}
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-3 text-center">
          <span className="line-clamp-4 font-display text-sm leading-tight text-tertiary">
            {fallbackLabel ?? alt}
          </span>
        </div>
      )}
    </div>
  );
}
