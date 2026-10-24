// TEMPORARY test surface for the Phase 4a companion endpoint. Exists for the dogfood
// and the D10 adversarial eval, not for users -- noindex, and slated for removal once
// the reader (or another real surface) hosts the companion for real. Do not build
// product polish here.
import { type CompanionAction, useCompanion } from "@foxing/client";
import { catalogRepo, companion } from "@foxing/core";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
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
  const [paywallOpen, setPaywallOpen] = useState(false);
  const openPaywall = useCallback(() => setPaywallOpen(true), []);
  return (
    <PageShell>
      <Container>
        <div className="mb-6 py-3 fx-companion-test-box">
          <p className="fx-companion-test-text">
            Test surface. Not a product page -- slated for removal once the reader hosts the
            companion. Your tier: <strong>{tier}</strong>.
          </p>
        </div>
        <PageHeader eyebrow="Phase 4a" title="Companion test" />
        <RunAction actions={actions} books={books} onPlusRequired={openPaywall} />
        {isAdmin ? <CacheBatch /> : null}
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

type BookOption = { id: string; slug: string; title: string; author: string };

function RunAction({
  actions,
  books,
  onPlusRequired,
}: {
  actions: string[];
  books: BookOption[];
  onPlusRequired: () => void;
}) {
  const [action, setAction] = useState(actions[0] ?? "");
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [message, setMessage] = useState("What do you think of this book?");
  const [selection, setSelection] = useState("");
  const companionRun = useCompanion();
  const { text: output, pending, error } = companionRun;

  async function run(event: React.FormEvent) {
    event.preventDefault();
    await companionRun.run({
      action: action as CompanionAction,
      bookId,
      message: message.trim() || undefined,
      selection: selection.trim() ? { text: selection.trim() } : undefined,
    });
  }

  // A free reader running a Plus action: open the paywall, the intended surface,
  // rather than only printing an error string.
  useEffect(() => {
    if (companionRun.planRequired) onPlusRequired();
  }, [companionRun.planRequired, onPlusRequired]);

  return (
    <section className="fx-companion-test-card">
      <h2 className="display-1">Run an action</h2>
      <form onSubmit={run} className="mt-4 fx-companion-test-form">
        <label className="block">
          <span className="fx-label">Action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="cap-select py-2 fx-companion-test-select"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="fx-label">Book</span>
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="cap-select py-2 fx-companion-test-select"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} by {b.author}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="fx-label">Message (chat-style actions)</span>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="cap-input py-2 fx-companion-test-select"
          />
        </label>
        <label className="block">
          <span className="fx-label">Selection text (word/passage actions)</span>
          <textarea
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            rows={2}
            className="cap-input py-2 fx-companion-test-select"
          />
        </label>
        <button type="submit" disabled={pending || !bookId} className="cap-btn">
          {pending ? "Streaming..." : "Run"}
        </button>
      </form>
      {output ? <div className="mt-4 fx-companion-test-card-2">{output}</div> : null}
      {error ? (
        <p className="mt-3 error" role="alert">
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
    <section className="mt-8 fx-companion-test-card">
      <h2 className="display-1">Cache batch (admin)</h2>
      <p className="mt-2 ui">
        Generate the 4 free-cached actions for up to a handful of catalog books missing them. Runs
        synchronously; keep this small.
      </p>
      <div className="mt-4 row">
        <label className="row-2">
          <span className="ui">Books</span>
          <input
            type="number"
            min={1}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="cap-input fx-companion-test-input"
          />
        </label>
        <button type="button" onClick={run} disabled={pending} className="cap-btn">
          {pending ? "Running..." : "Run batch"}
        </button>
      </div>
      {result ? (
        <p className="mt-4 fx-companion-test-text-2" role="status">
          {result.booksProcessed} books, {result.actionsGenerated} actions,{" "}
          {(result.totalCostCents / 100).toFixed(2)} USD.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
