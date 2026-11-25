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

// The search palette on a page that does not hydrate, started by the header island, from the same commands as the React palette. Only a signed-out reader sees such a page, so the quick links are the public ones.

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
