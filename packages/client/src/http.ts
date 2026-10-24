// The one /api/v1 transport for web and mobile. Web calls it same-origin with the
// session cookie; mobile passes a base URL and a headers() that adds the Better Auth
// cookie from secure storage. Every failure becomes an ApiError whose message is
// fit to show the reader as-is (role="alert" on web, an inline error on mobile):
// nothing is swallowed.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const OFFLINE_MESSAGE = "Could not reach the server. Check your connection and try again.";

export interface ApiClientOptions {
  /** Origin the API lives on; "" for same-origin (web). */
  baseUrl?: string;
  /** Extra headers per request, e.g. mobile's session cookie. */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
  credentials?: RequestCredentials;
  /** Opens a WebSocket; mobile passes one that sends the session cookie. */
  openSocket?: (url: string) => WebSocket;
}

type Body = Record<string, unknown> | unknown[] | undefined;

export function createApiClient(opts: ApiClientOptions = {}) {
  const base = `${opts.baseUrl ?? ""}/api/v1`;
  const doFetch = opts.fetch ?? ((input, init) => fetch(input, init));

  async function request<T>(
    method: string,
    path: string,
    body?: Body,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    Object.assign(headers, await opts.headers?.());

    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: opts.credentials,
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new ApiError(0, "network", OFFLINE_MESSAGE);
    }

    const data = (await res.json().catch(() => null)) as
      | (T & { error?: { code?: string; message?: string; details?: unknown } })
      | null;
    if (!res.ok) {
      throw new ApiError(
        res.status,
        data?.error?.code ?? "http_error",
        data?.error?.message ?? `Request failed (${res.status}). Try again.`,
        data?.error?.details,
      );
    }
    // A body-less success (204) is still a success: callers test the result for truth.
    return (data ?? {}) as T;
  }

  /** POSTs and reads a server-sent event stream, handing each event to onEvent. */
  async function stream(
    path: string,
    body: Body,
    onEvent: (event: string, data: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    };
    Object.assign(headers, await opts.headers?.());
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: opts.credentials,
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new ApiError(0, "network", OFFLINE_MESSAGE);
    }
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string; details?: unknown };
      } | null;
      throw new ApiError(
        res.status,
        data?.error?.code ?? "http_error",
        data?.error?.message ?? `Request failed (${res.status}). Try again.`,
        data?.error?.details,
      );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: !done });
      const events = buffer.split("\n\n");
      buffer = done ? "" : (events.pop() ?? "");
      for (const raw of events) {
        let event = "message";
        const data: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          // A multi-line payload arrives as several data lines; one leading space is framing.
          else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length > 0) onEvent(event, data.join("\n"));
      }
      if (done) return;
    }
  }

  return {
    get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
    post: <T>(path: string, body: Body = {}) => request<T>("POST", path, body),
    put: <T>(path: string, body?: Body) => request<T>("PUT", path, body),
    patch: <T>(path: string, body: Body) => request<T>("PATCH", path, body),
    delete: <T>(path: string, body?: Body) => request<T>("DELETE", path, body),
    stream,
    /** A WebSocket to an /api/v1 path, on the same origin as the requests. */
    socket: (path: string): WebSocket => {
      const origin = opts.baseUrl || globalThis.location.origin;
      const url = `${origin.replace(/^http/, "ws")}/api/v1${path}`;
      return opts.openSocket ? opts.openSocket(url) : new WebSocket(url);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** A query string from defined values only. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number | boolean] =>
      e[1] !== undefined && e[1] !== null && e[1] !== "",
  );
  if (entries.length === 0) return "";
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}`;
}

/** The message to show for a failed mutation or query, or null. */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return error.message;
  return OFFLINE_MESSAGE;
}
