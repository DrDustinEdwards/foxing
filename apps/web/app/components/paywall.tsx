// Soft Plus paywall. A modal Capsomer dialog (native <dialog>, so the page behind is inert, focus
// stays inside, Esc and the backdrop dismiss it, and focus returns to the opener), and it NEVER
// blocks the reader. Triggered when a free user hits a Plus action (the companion 403 plus_required
// is the first consumer). The CTA starts a Stripe Checkout with a 7-day trial via
// POST /api/v1/billing/checkout and redirects to the returned URL. Pricing copy is kept
// local (not imported from core) so the client bundle stays free of the billing/Stripe
// layer; it mirrors foxing/monetization.md.
import { useCheckout } from "@foxing/client";
import { useId, useState } from "react";
import { Dialog, DialogClose } from "capsomer/react/dialog";
import { Link } from "capsomer/react/link";
import { PlanChoice } from "capsomer/react/price-card";

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
  const titleId = useId();

  async function startTrial() {
    const r = await checkout.run({ plan });
    if (r) {
      setLeaving(true);
      window.location.assign(r.url);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      closeButton={false}
      aria-labelledby={titleId}
      className="fx-paywall-card"
    >
      <p id={titleId} className="fx-paywall-title">
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

      <div className="mt-6">
        <PlanChoice
          name="plan"
          legend={<span className="cap-sr-only">Choose a Foxing Plus plan</span>}
          value={plan}
          onChange={(v) => setPlan(v as Plan)}
          options={(Object.keys(PLANS) as Plan[]).map((key) => ({
            value: key,
            name: PLANS[key].label,
            price: (
              <>
                {PLANS[key].price}
                {PLANS[key].note ? (
                  <>
                    {" "}
                    <span className="fx-paywall-label-3">{PLANS[key].note}</span>
                  </>
                ) : null}
              </>
            ),
          }))}
        />
      </div>

      <button
        type="button"
        onClick={() => void startTrial()}
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
      {/* Last in the order, as Capsomer's Close is, so opening focuses the chosen plan. */}
      <DialogClose label="Dismiss" className="fx-paywall-btn" />
    </Dialog>
  );
}
