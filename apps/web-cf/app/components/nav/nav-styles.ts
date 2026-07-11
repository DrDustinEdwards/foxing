import { cn } from "~/lib/cn";

// Shared desktop primary-nav item treatment: an underline that grows from the left on
// hover and sits solid when the item is active (a link) or open (a mega-menu trigger).
// Ported from the legacy nav's active/hover underline so links and dropdown triggers
// read as one row.
const BASE =
  "relative inline-flex h-9 items-center rounded-md px-3 font-ui text-sm transition-colors " +
  "after:pointer-events-none after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 " +
  "after:origin-left after:rounded-full after:bg-brand-text after:transition-transform after:content-['']";

export function primaryItemClass(active: boolean, extra?: string): string {
  return cn(
    BASE,
    active
      ? "text-primary after:scale-x-100"
      : "text-secondary hover:text-primary after:scale-x-0 hover:after:scale-x-100",
    extra,
  );
}
