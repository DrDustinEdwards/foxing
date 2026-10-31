import { createApiClient, createFoxingQueryClient, FoxingDataProvider } from "@foxing/client";
import { ErrorPage, errorTitle } from "capsomer/react/error-page";
import { useState } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
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
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

// Set data-theme before paint so there is no theme flash. Stored preference wins;
// otherwise follow the OS. Attribute-driven per design-system.md. Capsomer's theme button
// (page-shell.tsx) remembers its choice under the same key, as the plain word.
// Migration shim: the key was "foxing-mode" (attribute data-mode) before the
// portfolio standardized on data-theme. Read the old key once, rewrite it to the
// new one, and drop it, so a returning reader keeps their choice. Safe to delete
// this branch once the old key is gone from the wild.
const NO_FLASH = `(function(){try{var t=localStorage.getItem("foxing-theme");if(!t){var old=localStorage.getItem("foxing-mode");if(old==="dark"||old==="light"){t=old;localStorage.setItem("foxing-theme",t);localStorage.removeItem("foxing-mode");}}if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  // The CSP nonce (workers/security-headers.ts) for every script this document renders.
  const nonce = useNonce();
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
      </head>
      <body>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

// Same-origin /api/v1 with the session cookie. One QueryClient per document, so the
// server never shares a cache between requests.
const api = createApiClient();

export default function App() {
  const [queryClient] = useState(createFoxingQueryClient);
  return (
    <FoxingDataProvider api={api} queryClient={queryClient}>
      <Outlet />
    </FoxingDataProvider>
  );
}

// Capsomer's error page. No site header: Foxing's reads the root loader's data, which the error path lacks.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} home="/" dev={import.meta.env.DEV} />;
}
