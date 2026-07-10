import { Link } from "react-router";
import { cn } from "~/lib/cn";

/** Page-width container. One measure for every catalog surface. */
export function Container({
  children,
  className,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <As className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</As>;
}

/** Small-caps DM Mono section eyebrow (design-system Rule 07). */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-tertiary",
        className,
      )}
    >
      {children}
    </p>
  );
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
  const cls = cn(
    "inline-flex items-center rounded-full bg-brand-subtle px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text",
    to && "transition-colors hover:bg-selected",
    className,
  );
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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 font-ui text-xs text-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  to?: string;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  rel?: string;
  target?: string;
  type?: "button" | "submit";
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-cover px-5 py-2.5 font-ui text-sm font-medium transition disabled:opacity-50";
// Primary fill is brand-text (#B04A1C), not brand-ui (#D4622E): brand-ui is
// large-text-only (3.75:1 with white), brand-text clears AA at 5.07:1. In dark mode
// the fill is light auburn, so the label flips to charcoal to keep the ratio.
const BUTTON_VARIANT = {
  primary:
    "bg-brand-text text-on-brand hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]",
  secondary: "border border-border-interactive text-primary hover:bg-hover",
  ghost: "text-brand-text hover:bg-brand-subtle",
} as const;

/** One button, three intents. Renders as Link (to), anchor (href), or button. */
export function Button({
  children,
  to,
  href,
  variant = "primary",
  className,
  rel,
  target,
  type = "button",
}: ButtonProps) {
  const cls = cn(BUTTON_BASE, BUTTON_VARIANT[variant], className);
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} rel={rel} target={target} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls}>
      {children}
    </button>
  );
}

/**
 * Entity-card variant (design-system Rule 15): shadow-sm -> shadow-md on hover, the
 * border stays subtle. Used for awards, clubs, journal cards. Renders as a link.
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
    <Link
      to={to}
      className={cn(
        "group block rounded-card border border-border-subtle bg-surface p-5 shadow-card-sm transition-shadow hover:shadow-card-md",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Breadcrumb trail. Also feeds BreadcrumbList JSON-LD (built separately in seo). */
export function Breadcrumbs({ trail }: { trail: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 font-ui text-xs text-tertiary">
        {trail.map((c, i) => (
          <li key={`${c.label}-${c.to ?? "end"}`} className="flex items-center gap-1.5">
            {c.to && i < trail.length - 1 ? (
              <Link to={c.to} className="hover:text-brand-text">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-secondary">
                {c.label}
              </span>
            )}
            {i < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Plain empty state. Illustration zones are not extended here (design decision). */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface px-6 py-16 text-center">
      <p className="font-display text-xl text-primary">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-secondary">{body}</p>}
    </div>
  );
}

const AVATAR_SIZE = {
  sm: "h-8 w-8 text-[0.7rem]",
  md: "h-9 w-9 text-sm",
  lg: "h-20 w-20 text-2xl",
} as const;

/** Two-letter initials from a display name, mirroring the legacy avatar fallback. */
export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Round avatar: the image when present, else brand-subtle initials. */
export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof AVATAR_SIZE;
}) {
  const cls = cn(
    "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-subtle font-ui font-semibold text-brand-subtle-text",
    AVATAR_SIZE[size],
  );
  if (src) {
    return (
      <span className={cls}>
        <img src={src} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden="true">
      {avatarInitials(name)}
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
    <header className={cn("mb-10", className)}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h1 className="font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
      {lede && <p className="mt-4 max-w-2xl text-lg text-secondary">{lede}</p>}
    </header>
  );
}
