// TEMPORARY test surface for the Phase 4a companion endpoint. Exists for the dogfood
// and the D10 adversarial eval, not for users -- noindex, and slated for removal once
// the reader (or another real surface) hosts the companion for real. Do not build
// product polish here.
import { useState } from "react";
import { catalogRepo, companion } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { loaderBase } from "~/lib/loader.server";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/companion-test";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { profile } = await requireProfile(env, request);
  const { db } = loaderBase(context, request);
  const browse = await catalogRepo.listBooks(db, { sort: "title", pageSize: 20 });
  return {
    isAdmin: profile.isAdmin,
    tier: profile.subscriptionTier,
    actions: companion.PLUS_ACTION_NAMES,
    books: browse.books,
  };
}

export function meta() {
  return [{ title: "Companion test | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function CompanionTest({ loaderData }: Route.ComponentProps) {
  const { isAdmin, tier, actions, books } = loaderData;
  return (
    <PageShell>
      <Container className="max-w-3xl">
        <div className="mb-6 rounded-md border border-warning-border bg-warning-bg px-4 py-3">
          <p className="font-ui text-sm text-warning">
            Test surface. Not a product page -- slated for removal once the reader hosts the
            companion. Your tier: <strong>{tier}</strong>.
          </p>
        </div>
        <PageHeader eyebrow="Phase 4a" title="Companion test" />
        <RunAction actions={actions} books={books} />
        {isAdmin ? <CacheBatch /> : null}
      </Container>
    </PageShell>
  );
}

type BookOption = { id: string; slug: string; title: string; author: string };

function RunAction({ actions, books }: { actions: string[]; books: BookOption[] }) {
  const [action, setAction] = useState(actions[0] ?? "");
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [message, setMessage] = useState("What do you think of this book?");
  const [selection, setSelection] = useState("");
  const [output, setOutput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setOutput("");

    try {
      const res = await fetch("/api/v1/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          bookId,
          message: message.trim() || undefined,
          selection: selection.trim() ? { text: selection.trim() } : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `Request failed (${res.status}).`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const eventLine = raw.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
          const eventName = eventLine?.slice(6).trim();
          const data = dataLine?.slice(5).trim() ?? "";
          if (eventName === "delta") {
            text += data;
            setOutput(text);
          } else if (eventName === "error") {
            setError(data);
          }
        }
      }
    } catch {
      setError("Stream failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-card border border-border-subtle bg-surface p-6">
      <h2 className="font-display text-xl text-primary">Run an action</h2>
      <form onSubmit={run} className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">Book</span>
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} by {b.author}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">
            Message (chat-style actions)
          </span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-ui text-sm text-secondary">
            Selection text (word/passage actions)
          </span>
          <textarea
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border-subtle bg-base px-3 py-2 font-ui text-sm text-primary"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !bookId}
          className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
        >
          {pending ? "Streaming..." : "Run"}
        </button>
      </form>
      {output ? (
        <div className="mt-4 whitespace-pre-wrap rounded-md border border-border-subtle bg-base p-4 font-body text-sm text-primary">
          {output}
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CacheBatch() {
  const [limit, setLimit] = useState(5);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    booksProcessed: number;
    actionsGenerated: number;
    totalCostCents: number;
  } | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/ops/companion-cache-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `Request failed (${res.status}).`);
        return;
      }
      setResult(await res.json());
    } catch {
      setError("Batch run failed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8 rounded-card border border-border-subtle bg-surface p-6">
      <h2 className="font-display text-xl text-primary">Cache batch (admin)</h2>
      <p className="mt-2 font-ui text-sm text-secondary">
        Generate the 4 free-cached actions for up to a handful of catalog books missing them. Runs
        synchronously; keep this small.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="font-ui text-sm text-secondary">Books</span>
          <input
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-20 rounded-md border border-border-subtle bg-base px-2 py-1 font-ui text-sm text-primary"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-md border border-border-interactive px-4 py-2 font-ui text-sm hover:bg-hover disabled:opacity-50"
        >
          {pending ? "Running..." : "Run batch"}
        </button>
      </div>
      {result ? (
        <p className="mt-4 font-ui text-sm text-secondary" role="status">
          {result.booksProcessed} books, {result.actionsGenerated} actions,{" "}
          {(result.totalCostCents / 100).toFixed(2)} USD.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 font-ui text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
