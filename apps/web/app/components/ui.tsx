import { ButtonLink, Link } from "capsomer/react/link";
import { cn } from "capsomer/react/hooks";

export function Container({
  children,
  className,
  as: As = "div",
  "data-gap": gap,
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  "data-gap"?: string;
}) {
  return (
    <As className={cn("fx-wrap", className)} data-gap={gap}>
      {children}
    </As>
  );
}

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

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("fx-chip", className)}>{children}</span>;
}

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

const BUTTON_VARIANT = { primary: "primary", secondary: undefined, ghost: "quiet" } as const;

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

/** Capsomer's card as one destination: the link wraps the card's <div> (an <article> there leaves the link with no name). */
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

export function Breadcrumbs({ trail }: { trail: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="cap-breadcrumb fx-breadcrumbs">
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

export function EmptyState({
  title,
  className,
  children,
}: {
  title: string;
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
      </div>
      {children ? <div className="cap-empty-content">{children}</div> : null}
    </div>
  );
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

export function PageHeader({
  title,
  lede,
  actions,
  children,
}: {
  title: string;
  lede?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const heading = (
    <div className="cap-stack" data-gap="5">
      <h1 className="fx-page-title">{title}</h1>
      {lede && (
        <p className="cap-text measure" data-size="lead" data-tone="muted">
          {lede}
        </p>
      )}
      {children}
    </div>
  );
  return (
    <header className="fx-page-head">
      {actions ? (
        <div className="cap-spread" data-gap="5" data-align="end">
          {heading}
          {actions}
        </div>
      ) : (
        heading
      )}
    </header>
  );
}

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
