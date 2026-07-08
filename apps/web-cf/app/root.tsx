import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "./app.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Source+Serif+4:opsz,wght@8..60,400..600&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://covers.foxing.app" },
];

// Set data-mode before paint so there is no theme flash. Stored preference wins;
// otherwise follow the OS. Attribute-driven per design-system.md.
const NO_FLASH = `(function(){try{var m=localStorage.getItem("foxing-mode");if(!m){m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-mode",m);}catch(e){document.documentElement.setAttribute("data-mode","light");}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#faf6ee" />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static no-flash theme script */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
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
        className="mt-2 rounded-cover bg-brand px-5 py-2.5 font-ui font-medium text-on-brand transition hover:bg-brand-hover"
      >
        Back to Foxing
      </a>
    </main>
  );
}
