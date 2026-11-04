import { attach, buildMenu, type Command, SEARCHING } from "capsomer/behavior/command-menu";
import { register } from "capsomer/behavior/shortcuts";

import {
  type Go,
  liveCommands,
  PALETTE_LABEL,
  PALETTE_PLACEHOLDER,
  quickCommands,
  readRecent,
  SEARCH_BUTTON_LABEL,
} from "./search-commands";

// The search palette on a page that does not hydrate (root.tsx), started by the header island (islands/header.ts), in
// place of the React CommandPalette (components/command-palette.tsx), from the same commands. Capsomer's command menu
// behavior builds and wires the dialog; what its React wrapper adds, the live results, is added here as its React wrapper does it: asked
// 180 ms after the last key, the one before aborted, shown after the matching commands, the list busy until they
// come. Ctrl K, Cmd K, "/" and the header's search button open it, fresh each time, as the React menu opens. Only a
// signed-out reader sees a page that does not hydrate, so the quick links are the public ones.

const go: Go = (to) => location.assign(to);
const SEARCH_DELAY_MS = 180;

/** Wires the live results into one built menu; `live` maps an option's id to its command. */
function wireLive(dialog: HTMLDialogElement, live: Map<string, Command>): void {
  const input = dialog.querySelector<HTMLInputElement>("[role='combobox']");
  const list = dialog.querySelector<HTMLElement>("[role='listbox']");
  const empty = dialog.querySelector<HTMLElement>("[data-cap-part='empty']");
  if (!input || !list) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | null = null;
  let refreshing = false;

  const setBusy = (busy: boolean) => {
    if (busy) list.setAttribute("aria-busy", "true");
    else list.removeAttribute("aria-busy");
  };
  // The menu's filter runs on every input (the listbox's own listener); results it has not been given yet say so.
  const sayBusy = () => {
    if (
      empty &&
      list.hasAttribute("aria-busy") &&
      !list.querySelector("[role='option']:not([hidden])")
    )
      empty.textContent = SEARCHING;
  };
  const show = (commands: Command[], query: string) => {
    for (const group of list.querySelectorAll("[data-live]")) group.remove();
    live.clear();
    const built = buildMenu(commands);
    for (const group of built.querySelectorAll<HTMLElement>(".cap-listbox-group")) {
      group.dataset.live = "";
      // Live results are shown whatever their words: the query is each one's keyword, so the filter keeps it.
      for (const option of group.querySelectorAll<HTMLElement>("[role='option']"))
        option.dataset.keywords = query;
      list.appendChild(group);
    }
    for (const c of commands) live.set(c.id, c);
    refreshing = true;
    input.dispatchEvent(new Event("input"));
    refreshing = false;
  };

  input.addEventListener("input", () => {
    if (refreshing) return;
    clearTimeout(timer);
    pending?.abort();
    const q = input.value.trim();
    if (!q) {
      show([], "");
      setBusy(false);
      return;
    }
    const ctrl = new AbortController();
    pending = ctrl;
    setBusy(true);
    sayBusy();
    timer = setTimeout(() => {
      liveCommands(q, ctrl.signal, go).then(
        (commands) => {
          if (ctrl.signal.aborted) return;
          setBusy(false);
          show(commands, q.toLowerCase());
        },
        () => {
          if (!ctrl.signal.aborted) setBusy(false);
        },
      );
    }, SEARCH_DELAY_MS);
  });
}

export function startSearchPalette(): void {
  let menu: { dialog: HTMLDialogElement; detach: () => void } | null = null;

  const open = (opener: Element | null) => {
    if (menu?.dialog.open) return;
    menu?.detach();
    menu?.dialog.remove();
    const commands = quickCommands(readRecent(), false, go);
    const own = new Map(commands.map((c) => [c.id, c]));
    const live = new Map<string, Command>();
    const dialog = buildMenu(commands, { label: PALETTE_LABEL, placeholder: PALETTE_PLACEHOLDER });
    document.body.appendChild(dialog);
    const attached = attach(dialog, (option) => {
      const id = option.dataset.capCommand ?? "";
      (own.get(id) ?? live.get(id))?.run();
    });
    wireLive(dialog, live);
    menu = { dialog, detach: attached.detach };
    attached.open("", opener);
  };

  register({
    key: ["Mod+k", "/"],
    label: "Open the command menu",
    group: "General",
    run: () => open(document.activeElement),
  });
  const button = document.querySelector(
    `.cap-site-header-extras button[aria-label="${SEARCH_BUTTON_LABEL}"]`,
  );
  button?.addEventListener("click", () => open(button));
}
