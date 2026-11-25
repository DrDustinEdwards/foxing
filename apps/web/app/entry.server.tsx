import { renderToReadableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import type { EntryContext, RouterContextProvider } from "react-router";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { isbot } from "isbot";
import { getNonce } from "@dustinedwards/site-runtime/context";
import { NonceContext } from "@dustinedwards/site-runtime/nonce";

// React Router prints every route error, so each scanner 404 wrote a stack trace; a route 404 is counted, not logged.
export { handleServerError as handleError } from "@dustinedwards/site-runtime/log";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const nonce = getNonce(loadContext);

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
