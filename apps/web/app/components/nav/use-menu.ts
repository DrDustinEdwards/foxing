// Shared behaviour for the header dropdown menus (Books, Account). Extracted from
// page-shell so later slices reuse the same open/dismiss + keyboard contract.
import { type FocusEvent, useEffect, useRef } from "react";

/**
 * Hover-to-open with keyboard-focus fallback for the primary mega-menus (Books,
 * Celebrity Picks), matching legacy behaviour. Returns handlers for the wrapper that
 * holds both the trigger and the menu:
 *  - pointer enter opens immediately; pointer leave closes after a short delay so a
 *    diagonal move from trigger to menu across the small gap does not flicker it shut.
 *  - focus entering the wrapper opens it (keyboard/tab users); focus leaving closes it.
 * Click still toggles (the trigger is a real <button>) and Escape/outside-click close
 * via useDismiss, so the menu is fully operable without a pointer.
 */
export function useHoverMenu(setOpen: (open: boolean) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // Unmount only: drop a pending close timer. Reads the ref directly so the effect
  // does not depend on `clear`, which is a new function every render.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return {
    onMouseEnter: () => {
      clear();
      setOpen(true);
    },
    onMouseLeave: () => {
      clear();
      timer.current = setTimeout(() => setOpen(false), 120);
    },
    onFocus: () => {
      clear();
      setOpen(true);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    },
  };
}

/** Dismiss an open menu on outside pointerdown or Escape. */
export function useDismiss(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

/**
 * Roving focus across the menu's items with the arrow keys, additive to the mouse
 * path (nothing is auto-focused on open, so click behaviour is unchanged). The
 * handler lives on the wrapper that holds both the trigger and the menu, so
 * ArrowDown from the trigger button moves into the first item.
 */
export function useRovingMenu(ref: React.RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;

    function onKey(event: KeyboardEvent) {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = Array.from(node?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next: number;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      else next = current <= 0 ? items.length - 1 : current - 1;
      items[next].focus();
    }

    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [ref, open]);
}
