import { CommandMenu } from "capsomer/react/command-menu";
import { useRemembered } from "capsomer/react/hooks";
import { useEffect, useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import {
  liveCommands,
  PALETTE_LABEL,
  PALETTE_PLACEHOLDER,
  parseRecent,
  quickCommands,
  RECENT_KEY,
} from "~/lib/search-commands";
import type { loader as RootLoader } from "~/root";

export function CommandPalette() {
  const navigate = useNavigate();
  const root = useRouteLoaderData<typeof RootLoader>("root");
  const signedIn = !!root?.navUser;
  const [open, setOpen] = useState(false);
  const recent = parseRecent(useRemembered(RECENT_KEY)[0]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("foxing:search-open", onOpen);
    return () => window.removeEventListener("foxing:search-open", onOpen);
  }, []);

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
