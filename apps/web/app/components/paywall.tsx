// Soft Plus paywall. Full-screen, dismissable, and it NEVER blocks the
// reader. Triggered when a free user hits a Plus action (the companion 403 plus_required
// is the first consumer). The CTA starts a Stripe Checkout with a 7-day trial via
// POST /api/v1/billing/checkout and redirects to the returned URL. Pricing copy is kept
// local (not imported from core) so the client bundle stays free of the billing/Stripe
// layer; it mirrors foxing/monetization.md.
import { useCheckout } from "@foxing/client";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

type Plan = "monthly" | "annual";

const PLANS: Record<Plan, { label: string; price: string; note: string }> = {
  annual: { label: "Annual", price: "$129.99/year", note: "Save $26" },
  monthly: { label: "Monthly", price: "$12.99/month", note: "" },
};

// Plus is the AI reading companion. Everything social (clubs, passage comments, shared
// annotations) is free, so the paywall sells the AI, never clubs.
const FEATURES = [
  "AI reading companion: instant word lookups, passage analysis, and chat",
  "AI Deep Dive: character arcs, symbolism, and criticism digests",
  "Character maps and AI-generated discussion questions",
  "Semantic scene search across the whole book",
  "AI recommendations with reasoning, and your reading personality",
  "Quote card image export",
];

export function Paywall({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [plan, setPlan] = useState<Plan>("annual");
  const checkout = useCheckout();
  // Stays pending while the browser leaves for Stripe.
  const [leaving, setLeaving] = useState(false);
  const pending = checkout.pending || leaving;
  const { error } = checkout;
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
    const r = await checkout.run({ plan });
    if (r) {
      setLeaving(true);
      window.location.assign(r.url);
    }
  }

  return (
    <div className="justify-center fx-paywall-row">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative fx-paywall-card"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="fx-paywall-btn"
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

        <p className="fx-paywall-title">
          <span aria-hidden="true">🦊</span> Foxing Plus
        </p>
        <p className="mt-1 italic fx-paywall-text">your AI reading companion.</p>

        <ul className="mt-5 fx-paywall-list">
          {FEATURES.map((f) => (
            <li key={f} className="fx-paywall-row-2">
              <span aria-hidden="true" className="accent-ui">
                +
              </span>
              {f}
            </li>
          ))}
        </ul>

        <fieldset className="mt-6">
          <legend id={titleId} className="cap-sr-only">
            Choose a Foxing Plus plan
          </legend>
          <div className="fx-paywall-grid">
            {(Object.keys(PLANS) as Plan[]).map((key) => {
              const selected = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPlan(key)}
                  className="fx-paywall-plan"
                >
                  <span className="block fx-paywall-label">{PLANS[key].label}</span>
                  <span className="block fx-paywall-label-2">{PLANS[key].price}</span>
                  {PLANS[key].note ? (
                    <span className="fx-paywall-label-3">{PLANS[key].note}</span>
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
          className="cap-btn mt-5 fx-paywall-btn-2"
          data-variant="primary"
          data-size="lg"
        >
          {pending ? "Starting..." : "Start free 7-day trial"}
        </button>
        <p className="mt-2 text-center fx-paywall-text-2">
          No charge until trial ends. Cancel anytime.
        </p>

        {error ? (
          <p className="mt-3 py-2 text-center fx-paywall-text-3" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-center fx-paywall-text-2">
          <Link to="/privacy" className="fx-paywall-link">
            Privacy
          </Link>
          <span aria-hidden="true"> · </span>
          <Link to="/terms" className="fx-paywall-link">
            Terms
          </Link>
        </p>
      </div>
    </div>
  );
}
