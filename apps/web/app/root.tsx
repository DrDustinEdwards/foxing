// First, before any module that builds a Zod schema: React Router evaluates the route modules ahead of entry.client's
// startPage(), and Zod's caught new Function("") probe is a Trusted Types violation under the enforced policy.
import "@dustinedwards/site-runtime/zod-jitless";
import { iconLinks } from "@drdustinedwards/site-helpers/icons";
import { createApiClient, createFoxingQueryClient, FoxingDataProvider } from "@foxing/client";
import { ErrorPage, errorTitle } from "capsomer/react/error-page";
import { LinkPrefetch } from "capsomer/react/link";
import { themeScript } from "capsomer/theme-server";
import { THEME_PREF_KEY } from "./lib/theme";
import { useState } from "react";
import { SITE_SCRIPT } from "virtual:islands";
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
// Foxing's faces from its own origin (Fontsource, bundled under /assets/): no blocking Google Fonts stylesheet, no second
// origin. vite.config.ts serves them with font-display: optional so text never moves once drawn.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import stylesheet from "./app.css?url";
import { cloudflareContext } from "./context";
import { getNavMenu, getNavUser } from "./lib/nav.server";
import { useNonce } from "@dustinedwards/site-runtime/nonce";
import { SITE_NAME } from "./lib/seo";
import { markup } from "capsomer/behavior/trusted-html";

// navUser is null for anonymous requests, keeping the server-rendered HTML signed-out (and edge-cacheable).
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const [navUser, navMenu] = await Promise.all([getNavUser(env, request), getNavMenu(env)]);
  return { navUser, navMenu };
}

export function meta({ error }: Route.MetaArgs) {
  return error ? [{ title: errorTitle(error, SITE_NAME) }] : [];
}

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  ...iconLinks(),
];

// Set data-theme before paint so there is no theme flash: the stored preference wins, otherwise the OS.
const FOLLOW_OS = `try{document.documentElement.setAttribute("data-theme",matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");}catch(e){}`;
const NO_FLASH = `${FOLLOW_OS}${themeScript(THEME_PREF_KEY)}`;

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  // HYDRATION IS OPT-IN BY ROUTE (`handle = { hydrate: true }`): public pages send no React (header, theme button and search
  // run from /site.js and app/islands/); the signed-in app, reader, admin, sign-in and search opt in, and a signed-in reader
  // hydrates every page (the account panel is React's; their pages are never edge-cached).
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
        <meta name="text-scale" content="scale" />
        <meta name="theme-color" content="#faf6ee" />
        {/* Raw HTML: static no-flash theme script. */}
        <script nonce={nonce} dangerouslySetInnerHTML={markup(NO_FLASH)} />
        <Meta />
        <Links nonce={nonce} />
        {/* Same-origin, so script-src 'self' allows it; the nonce is renewed per reader like every other. Not on a
            hydrating page, whose React components wire the same markup themselves. */}
        {hydrates ? null : <script {...SITE_SCRIPT} defer nonce={nonce} />}
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

// One QueryClient per document, so the server never shares a cache between requests.
const api = createApiClient();

// Capsomer's Link prefetches on hover, running the target's loader; this loader writes on a GET (KV, an AI call), so it is never prefetched.
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

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} home="/" dev={import.meta.env.DEV} />;
}
