// Soft Plus paywall (Phase 4b). Full-screen, dismissable, and it NEVER blocks the
// reader. Triggered when a free user hits a Plus action (the companion 403 plus_required
// is the first consumer). The CTA starts a Stripe Checkout with a 7-day trial via
// POST /api/v1/billing/checkout and redirects to the returned URL. Pricing copy is kept
// local (not imported from core) so the client bundle stays free of the billing/Stripe
// layer; it mirrors foxing/monetization.md.
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/cn";

type Plan = "monthly" | "annual";

const PLANS: Record<Plan, { label: string; price: string; note: string }> = {
  annual: { label: "Annual", price: "$129.99/year", note: "Save $26" },
  monthly: { label: "Monthly", price: "$12.99/month", note: "" },
};

const FEATURES = [
  "AI reading companion: word lookups, passage analysis, and chat",
  "AI Deep Dive: character arcs, symbolism, and criticism digests",
  "Semantic scene search and AI discussion questions",
  "Unlimited book clubs, with inline passage comments",
  "Quote card image export",
  "Year in Reading, on demand",
];

export function Paywall({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan>("annual");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function startTrial() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (res.ok && body?.url) {
        window.location.assign(body.url);
        return;
      }
      setError(body?.error?.message ?? `Could not start checkout (${res.status}).`);
    } catch {
      setError("Could not reach billing. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-hero bg-section-charcoal p-8 text-on-dark shadow-card-md"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-on-dark/70 transition-colors hover:bg-white/10 hover:text-on-dark"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <p className="flex items-center gap-2 font-display text-2xl font-semibold">
          <span aria-hidden="true">🦊</span> Foxing Plus
        </p>
        <p className="mt-1 font-body text-base italic text-on-dark/70">reading, together.</p>

        <ul className="mt-5 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2 font-ui text-sm text-on-dark/90">
              <span aria-hidden="true" className="text-brand-ui">
                +
              </span>
              {f}
            </li>
          ))}
        </ul>

        <fieldset className="mt-6">
          <legend id={titleId} className="sr-only">
            Choose a Foxing Plus plan
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PLANS) as Plan[]).map((key) => {
              const selected = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPlan(key)}
                  className={cn(
                    "rounded-card border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-brand-ui bg-white/10"
                      : "border-white/20 hover:border-white/40",
                  )}
                >
                  <span className="block font-ui text-xs uppercase tracking-[0.08em] text-on-dark/70">
                    {PLANS[key].label}
                  </span>
                  <span className="block font-ui text-sm font-medium">{PLANS[key].price}</span>
                  {PLANS[key].note ? (
                    <span className="mt-0.5 inline-block rounded-full bg-brand-ui px-1.5 py-0.5 font-mono text-[0.625rem] text-on-brand">
                      {PLANS[key].note}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={startTrial}
          disabled={pending}
          className="mt-5 w-full rounded-cover bg-brand-ui px-4 py-3 font-ui text-sm font-medium text-on-brand transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Starting..." : "Start free 7-day trial"}
        </button>
        <p className="mt-2 text-center font-ui text-xs text-on-dark/60">
          No charge until trial ends. Cancel anytime.
        </p>

        {error ? (
          <p
            className="mt-3 rounded-md border border-brand-ui/60 px-3 py-2 text-center font-ui text-sm text-on-dark"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-center font-ui text-xs text-on-dark/60">
          <Link to="/privacy" className="underline hover:text-on-dark">
            Privacy
          </Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms" className="underline hover:text-on-dark">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
