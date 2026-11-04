// The search palette: Capsomer's command menu, opened by Ctrl K, Cmd K, "/" or the header's
// search button (which dispatches "foxing:search-open"). Recent searches and quick links are
// its commands; typing federates catalog books, authors, people and clubs from
// /api/v1/search/suggest through the menu's live search.
// On a page that does not hydrate the search-palette island (islands/search-palette.ts) is the same
// menu, from the same commands (lib/search-commands.ts).
import { CommandMenu } from "capsomer/react/command-menu";
import { useEffect, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import {
  liveCommands,
  PALETTE_LABEL,
  PALETTE_PLACEHOLDER,
  quickCommands,
  readRecent,
} from "~/lib/search-commands";
import type { loader as RootLoader } from "~/root";

export function CommandPalette() {
  const navigate = useNavigate();
  const root = useRouteLoaderData<typeof RootLoader>("root");
  const signedIn = !!root?.navUser;
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("foxing:search-open", onOpen);
    return () => window.removeEventListener("foxing:search-open", onOpen);
  }, []);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const go = (to: string) => void navigate(to);
  const commands = quickCommands(recent, signedIn, go);

  return (
    <CommandMenu
      open={open}
      onOpenChange={setOpen}
      commands={commands}
      search={(q, signal) => liveCommands(q, signal, go)}
      label={PALETTE_LABEL}
      placeholder={PALETTE_PLACEHOLDER}
    />
  );
}
