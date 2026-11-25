import { cn } from "capsomer/react/hooks";
import { coverAttributes } from "~/lib/images";
import { Picture } from "capsomer/react/picture";

type Props = {
  src: string | null | undefined;
  alt: string;
  fallbackLabel?: string;
  priority?: boolean;
  eager?: boolean;
  use?: "cover" | "coverThumb";
  sizes?: string;
  className?: string;
};

/** Book cover in a no-CLS 2:3 box, as a `<picture>` of AVIF and WebP sizes, with a typographic placeholder when missing. */
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

export function CoverPicture({
  src,
  use,
  sizes,
  ...rest
}: {
  src: string;
  alt: string;
  use?: "cover" | "coverThumb";
  sizes?: string;
  priority?: boolean;
  eager?: boolean;
  className?: string;
}) {
  return <Picture attrs={coverAttributes(src, { use, sizes })} {...rest} />;
}
