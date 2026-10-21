import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";
import { cloudflareContext } from "./context";
import { getNavMenu, getNavUser } from "./lib/nav.server";
import { useNonce } from "./lib/nonce";
import { COVER_ORIGIN } from "./lib/origins";

// Resolve the signed-in nav identity plus the public mega-menu data once per request;
// the shell reads both via useRouteLoaderData("root"). navUser is null for anonymous
// requests, keeping the server-rendered HTML signed-out (and edge-cacheable).
export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const [navUser, navMenu] = await Promise.all([getNavUser(env, request), getNavMenu(env)]);
  return { navUser, navMenu };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Source+Serif+4:opsz,wght@8..60,400..600&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: COVER_ORIGIN },
];

// Set data-theme before paint so there is no theme flash. Stored preference wins;
// otherwise follow the OS. Attribute-driven per design-system.md.
// Migration shim: the key was "foxing-mode" (attribute data-mode) before the
// portfolio standardized on data-theme. Read the old key once, rewrite it to the
// new one, and drop it, so a returning reader keeps their choice. Safe to delete
// this branch once the old key is gone from the wild.
const NO_FLASH = `(function(){try{var t=localStorage.getItem("foxing-theme");if(!t){var old=localStorage.getItem("foxing-mode");if(old==="dark"||old==="light"){t=old;localStorage.setItem("foxing-theme",t);localStorage.removeItem("foxing-mode");}}if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  // The CSP nonce (workers/security-headers.ts) for every script this document renders.
  const nonce = useNonce();
  return (
    <html lang="en" data-theme="light">
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

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isRouteError =
    error && typeof error === "object" && "status" in error && "statusText" in error;
  const status = isRouteError ? (error as { status: number }).status : 500;
  const title = status === 404 ? "Page not found" : "Something went wrong";
  const message =
    status === 404
      ? "That page has wandered off the shelf."
      : "An unexpected error occurred. Try again in a moment.";
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.18em] text-tertiary">Error {status}</p>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="text-lg text-secondary">{message}</p>
      <a
        href="/"
        className="mt-2 rounded-cover bg-brand-text px-5 py-2.5 font-ui font-medium text-on-brand transition hover:bg-brand-hover dark:text-[color:var(--section-charcoal)]"
      >
        Back to Foxing
      </a>
    </main>
  );
}
