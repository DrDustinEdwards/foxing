import { attach, buildMenu } from "capsomer/behavior/command-menu";
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
// behavior builds and wires the dialog, live results included (attach's `search`, as the React menu's). Ctrl K, Cmd K,
// "/" and the header's search button open it, fresh each time, as the React menu opens. Only a signed-out reader sees a
// page that does not hydrate, so the quick links are the public ones.

const go: Go = (to) => location.assign(to);

export function startSearchPalette(): void {
  let menu: { dialog: HTMLDialogElement; detach: () => void } | null = null;

  const open = (opener: Element | null) => {
    if (menu?.dialog.open) return;
    menu?.detach();
    menu?.dialog.remove();
    const commands = quickCommands(readRecent(), false, go);
    const own = new Map(commands.map((c) => [c.id, c]));
    const dialog = buildMenu(commands, { label: PALETTE_LABEL, placeholder: PALETTE_PLACEHOLDER });
    document.body.appendChild(dialog);
    const attached = attach(
      dialog,
      (option, found) => (found ?? own.get(option.dataset.capCommand ?? ""))?.run(),
      { search: (q, signal) => liveCommands(q, signal, go) },
    );
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
