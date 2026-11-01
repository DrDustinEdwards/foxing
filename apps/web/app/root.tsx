import { iconLinks } from "@drdustinedwards/site-helpers/icons";
import { createApiClient, createFoxingQueryClient, FoxingDataProvider } from "@foxing/client";
import { ErrorPage, errorTitle } from "capsomer/react/error-page";
import { LinkPrefetch } from "capsomer/react/link";
import { themeScript } from "capsomer/theme-server";
import { useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root";
// Foxing's faces from its own origin (Fontsource, the files Google Fonts serves, bundled under /assets/): no
// stylesheet from fonts.googleapis.com blocking the first paint, and no second origin to connect to. The variable
// files carry Fraunces' and Source Serif's optical sizes, as the Google request asked for.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import stylesheet from "./app.css?url";
import { cloudflareContext } from "./context";
import { getNavMenu, getNavUser } from "./lib/nav.server";
import { useNonce } from "./lib/nonce";
import { SITE_NAME } from "./lib/seo";

// Resolve the signed-in nav identity plus the public mega-menu data once per request;
// the shell reads both via useRouteLoaderData("root"). navUser is null for anonymous
// requests, keeping the server-rendered HTML signed-out (and edge-cacheable).
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const [navUser, navMenu] = await Promise.all([getNavUser(env, request), getNavMenu(env)]);
  return { navUser, navMenu };
}

// The error path's title (an unmatched address matches no route but the root); every page sets its own.
export function meta({ error }: Route.MetaArgs) {
  return error ? [{ title: errorTitle(error, SITE_NAME) }] : [];
}

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...iconLinks(),
];

// Set data-theme before paint so there is no theme flash. Stored preference wins (Capsomer's themeScript, under
// Foxing's key; Capsomer's theme button in page-shell.tsx remembers its choice there, as the plain word); otherwise
// follow the OS. Attribute-driven per design-system.md.
// Migration shim: the key was "foxing-mode" (attribute data-mode) before the portfolio standardized on data-theme.
// Move the old key over once and drop it, so a returning reader keeps their choice. Safe to delete this part once
// the old key is gone from the wild.
const MIGRATE_OLD_KEY = `try{if(!localStorage.getItem("foxing-theme")){var o=localStorage.getItem("foxing-mode");if(o==="dark"||o==="light"){localStorage.setItem("foxing-theme",o);localStorage.removeItem("foxing-mode");}}}catch(e){}`;
const FOLLOW_OS = `try{document.documentElement.setAttribute("data-theme",matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}catch(e){}`;
const NO_FLASH = `${MIGRATE_OLD_KEY}${FOLLOW_OS}${themeScript("foxing-theme")}`;

export function Layout({ children }: { children: React.ReactNode }) {
  // The CSP nonce (workers/security-headers.ts) for every script this document renders.
  const nonce = useNonce();
  // HYDRATION IS OPT-IN BY ROUTE (`handle = { hydrate: true }`), as on dustinedwards.info. The public pages (home, the
  // catalog, authors, awards, picks, the Journal, profiles, lists and the guides) send no React: their header, theme
  // button, search palette and search field run from /site.js (app/site.ts) and its islands (app/islands/). The
  // signed-in app, the reader, the admin, sign-in and sign-up, and search with its filters opt in. A signed-in reader
  // hydrates on every page: their header carries the account panel, Sign out and the Your Foxing bar, which are
  // React's, and their pages are private and never edge-cached.
  const signedIn = Boolean(useRouteLoaderData<typeof loader>("root")?.navUser);
  const matches = useMatches();
  const hydrates =
    signedIn ||
    matches.some((m) => (m.handle as { hydrate?: boolean } | undefined)?.hydrate === true);
  return (
    <html
      lang="en"
      data-theme="light"
      data-family="fox"
      data-cap-site="foxing"
      data-density="comfortable"
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#faf6ee" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static no-flash theme script */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <Meta />
        <Links nonce={nonce} />
        {/* Same-origin, so script-src 'self' allows it; the nonce is renewed per reader like every other. Not on a
            hydrating page, whose React components wire the same markup themselves. */}
        {hydrates ? null : <script src="/site.js" defer nonce={nonce} />}
      </head>
      <body>
        {children}
        {hydrates ? (
          <>
            <ScrollRestoration nonce={nonce} />
            <Scripts nonce={nonce} />
          </>
        ) : null}
      </body>
    </html>
  );
}

// Same-origin /api/v1 with the session cookie. One QueryClient per document, so the
// server never shares a cache between requests.
const api = createApiClient();

// Capsomer's Link prefetches on hover, which runs the target's loader. This loader writes on a GET
// (KV, and an AI call for a Plus reader), so it is never prefetched, beyond the family's own list.
const GET_WRITERS = ["/find-next-book"];

export default function App() {
  const [queryClient] = useState(createFoxingQueryClient);
  return (
    <LinkPrefetch exclude={GET_WRITERS}>
      <FoxingDataProvider api={api} queryClient={queryClient}>
        <Outlet />
      </FoxingDataProvider>
    </LinkPrefetch>
  );
}

// Capsomer's error page. No site header: Foxing's reads the root loader's data, which the error path lacks.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} home="/" dev={import.meta.env.DEV} />;
}
