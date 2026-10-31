// Server entry for the Workers runtime (streaming SSR via renderToReadableStream).
// Its presence tells React Router the runtime is not Node.
import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import type { EntryContext, RouterContextProvider } from "react-router";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { isbot } from "isbot";
import { cspNonceContext } from "./context";
import { NonceContext } from "./lib/nonce";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  // The request's CSP nonce (workers/security-headers.ts): on React's streaming scripts, React
  // Router's hydration scripts and, through NonceContext, every script the root Layout renders.
  const nonce = loadContext.get(cspNonceContext);

  const body = await renderToReadableStream(
    <NonceContext.Provider value={nonce}>
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
    </NonceContext.Provider>,
    {
      nonce,
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) logEvent("render_failed", { error }, { level: "error" });
      },
    },
  );
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
