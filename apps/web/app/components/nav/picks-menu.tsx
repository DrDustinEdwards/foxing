// Celebrity Picks dropdown. Opens on hover with a keyboard-focus + click fallback (legacy
// behaviour). Featured clubs come from the root loader (listExternalClubs), so the menu
// renders server-side with no client fetch. The BOTM card only appears when a published
// Book of the Month exists (getCurrentBotm is published-only). "This month's picks" points
// at /book-of-the-month (a real route that shows the current pick or an empty state);
// legacy's /picks/YYYY/MM archive has no route here, so it is not linked.
import { useRef, useState } from "react";
import { Link } from "react-router";
import type { NavBotm, NavFeaturedClub } from "~/lib/nav.server";
import { primaryItemClass } from "./nav-styles";
import { useDismiss, useHoverMenu, useRovingMenu } from "./use-menu";

export function PicksMenu({
  featuredClubs,
  botm,
}: {
  featuredClubs: NavFeaturedClub[];
  botm: NavBotm | null;
}) {
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
        Celebrity Picks
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Celebrity Picks"
          className="absolute left-0 top-11 z-50 w-[24rem] rounded-hero border border-border-subtle bg-surface p-5 shadow-card-md"
        >
          {botm ? (
            <Link
              to="/book-of-the-month"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="mb-4 block rounded-lg border border-border-subtle bg-sunken p-3 transition-colors hover:border-border-interactive"
            >
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-brand-text">
                Foxing pick
              </p>
              <p className="mt-1 font-display text-sm text-primary">{botm.title}</p>
              <p className="font-ui text-xs text-tertiary">{botm.author}</p>
            </Link>
          ) : null}
          {featuredClubs.length > 0 ? (
            <>
              <p className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-tertiary">
                Featured clubs
              </p>
              <ul role="none" className="grid grid-cols-2 gap-0.5">
                {featuredClubs.map((club) => (
                  <li role="none" key={club.slug}>
                    <Link
                      to={`/picks/${club.slug}`}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-2 py-1.5 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
                    >
                      {club.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
            <Link
              to="/picks"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1.5 font-ui text-sm text-brand-text transition-colors hover:bg-hover"
            >
              View all picks
            </Link>
            <Link
              to="/book-of-the-month"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1.5 font-ui text-sm text-secondary transition-colors hover:bg-hover hover:text-brand-text"
            >
              This month's pick
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
