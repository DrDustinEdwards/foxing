// Books dropdown. Opens on hover with a keyboard-focus + click fallback (legacy
// behaviour). Browse items are real routes; era chips map to /books?era= filters that
// ship today. By Mood + the 10 mood/theme chips are CUT until mood_tags is populated
// (all catalog books are '[]' today; generating them needs ANTHROPIC_API_KEY as a Worker
// secret, which is not set). The era list mirrors core ERA_BUCKETS (facets.ts), kept
// local so the client bundle does not pull in the core query layer.
import { useRef, useState } from "react";
import { Link } from "react-router";
import { primaryItemClass } from "./nav-styles";
import { useDismiss, useHoverMenu, useRovingMenu } from "./use-menu";

const BOOKS_BROWSE = [
  { to: "/books", label: "All books" },
  { to: "/awards", label: "Award winners" },
];
const BOOKS_ERAS = [
  { slug: "pre-1800", label: "Before 1800" },
  { slug: "1800-1849", label: "1800 to 1849" },
  { slug: "1850-1899", label: "1850 to 1899" },
  { slug: "1900-1949", label: "1900 to 1949" },
  { slug: "modern", label: "1950 and later" },
];

export function BooksMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  useRovingMenu(ref, open);
  const hover = useHoverMenu(setOpen);

  return (
    <div ref={ref} className="relative" {...hover}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={primaryItemClass(open, "gap-1")}
      >
        Books
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Books"
          className="absolute left-0 top-11 z-50 w-[26rem] rounded-hero border border-border-subtle bg-surface p-5 shadow-card-md"
        >
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Browse
              </p>
              <ul role="none" className="space-y-0.5">
                {BOOKS_BROWSE.map((item) => (
                  <li role="none" key={item.to}>
                    <Link
                      to={item.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-1.5 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                By era
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BOOKS_ERAS.map((era) => (
                  <Link
                    key={era.slug}
                    to={`/books?era=${era.slug}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="inline-flex rounded-full bg-brand-subtle px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-brand-subtle-text transition-colors hover:bg-selected"
                  >
                    {era.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
