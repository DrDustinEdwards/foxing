import type { catalogRepo } from "@foxing/core";
import { createContext } from "react-router";

import { cloudflareContext, cspNonceContext } from "@dustinedwards/site-runtime/context";

export { cloudflareContext, cspNonceContext };

/** The post a Carrel preview draws in place of the stored one; null on every other render. */
export type JournalPreview = catalogRepo.JournalPost & { coverFocus: string | null };

export const journalPreviewContext = createContext<JournalPreview | null>(null);
