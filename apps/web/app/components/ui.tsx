import { ButtonLink, Link } from "capsomer/react/link";
import { cn } from "capsomer/react/hooks";

/** Page-width container. One measure for every catalog surface. */
export function Container({
  children,
  className,
  as: As = "div",
  "data-gap": gap,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  /** A layout class's gap step (capsomer/utilities.css), when className holds one. */
  "data-gap"?: string;
}) {
  return (
    <As className={cn("fx-wrap", className)} data-gap={gap}>
      {children}
    </As>
  );
}

/** Small-caps DM Mono section eyebrow (design-system Rule 07). */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

/** Brand-subtle tag pill (Rule 07 tag role). */
export function TagPill({
  children,
  to,
  className,
}: {
  children: React.ReactNode;
  to?: string;
  className?: string;
}) {
  const cls = cn("fx-tag", className);
  return to ? (
    <Link to={to} className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** Neutral metadata chip (era, length, language, etc.). */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("fx-chip", className)}>{children}</span>;
}

/** A filter choice in a row of chips; pressed when it is the one shown. */
export function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="cap-chip">
      {children}
    </button>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  to?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
};

// Capsomer's button: primary is the family's primary fill (AA with its label in both themes),
// secondary its outlined default, ghost its quiet variant in the accent text (fx-btn-ghost).
const BUTTON_VARIANT = { primary: "primary", secondary: undefined, ghost: "quiet" } as const;

/** One button, two intents. Renders as ButtonLink (to) or button. */
export function Button({
  children,
  to,
  variant = "primary",
  className,
  type = "button",
}: ButtonProps) {
  const extra = cn(variant === "ghost" && "fx-btn-ghost", className);
  const v = BUTTON_VARIANT[variant];
  if (to) {
    return (
      <ButtonLink to={to} className={extra || undefined} variant={v}>
        {children}
      </ButtonLink>
    );
  }
  return (
    <button type={type} className={cn("cap-btn", extra)} data-variant={v}>
      {children}
    </button>
  );
}

/**
 * Capsomer's card (capsomer/card.css), one destination: the link wraps the card's <div> (an <article> there leaves the link with no name), whose
 * heading and text are its own children. Foxing's entity look (design-system Rule 15: shadow-sm to
 * shadow-md on hover, the border stays quiet) is ui.css .fx-entity. Awards, clubs, lists.
 */
export function EntityCard({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={className}>
      <div className="cap-card fx-entity">{children}</div>
    </Link>
  );
}

/** Breadcrumb trail, Capsomer's. The BreadcrumbList JSON-LD is Prelum's (lib/seo.ts). */
export function Breadcrumbs({ trail }: { trail: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="cap-breadcrumb mb-6">
      <ol className="cap-breadcrumb-list">
        {trail.map((c, i) => (
          <li key={`${c.label}-${c.to ?? "end"}`} className="cap-breadcrumb-item">
            {c.to && i < trail.length - 1 ? (
              <Link to={c.to} className="cap-breadcrumb-link">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="cap-breadcrumb-page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Plain empty state. Illustration zones are not extended here (design decision). */
export function EmptyState({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={className ? `cap-empty fx-empty ${className}` : "cap-empty fx-empty"}
      data-kind="nothing-yet"
    >
      <div className="cap-empty-header">
        <p className="cap-empty-title">{title}</p>
        {body && <p className="cap-empty-text">{body}</p>}
      </div>
      {children ? <div className="cap-empty-content">{children}</div> : null}
    </div>
  );
}

/** Two-letter initials from a display name, mirroring the legacy avatar fallback. */
export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Round avatar: the image when present, else initials on the soft accent. */
export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className="cap-avatar fx-avatar" data-fx-size={size} aria-hidden="true">
      <span className="cap-avatar-fallback">{avatarInitials(name)}</span>
      {src ? <img src={src} alt="" className="cap-avatar-image" /> : null}
    </span>
  );
}

/** Page title block: eyebrow + display heading + optional lede. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <header className={cn("fx-page-head", className)}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="fx-page-title">{title}</h1>
      {lede && (
        <p className="cap-text measure mt-4" data-size="lead" data-tone="muted">
          {lede}
        </p>
      )}
    </header>
  );
}

/** An action's failure message, announced to assistive tech; nothing when there is none. */
export function FormError({
  error,
  className,
}: {
  error: string | null | undefined;
  className?: string;
}) {
  if (!error) return null;
  return (
    <p
      className={className ? `cap-text ${className}` : "cap-text"}
      data-size="small"
      data-tone="crit"
      data-face="ui"
      role="alert"
    >
      {error}
    </p>
  );
}
