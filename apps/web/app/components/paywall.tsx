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
// The plan choice's styles load only where the paywall opens (React 19 hoists the link).
import planChoiceCss from "capsomer/plan-choice.css?url";

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
      <link rel="stylesheet" href={planChoiceCss} precedence="default" />
      <div className="cap-stack" data-gap="6">
        <div className="cap-stack" data-gap="2">
          <p id={titleId} className="fx-paywall-title">
            <span aria-hidden="true">🦊</span> Foxing Plus
          </p>
          <p className="italic fx-paywall-text">your AI reading companion.</p>
        </div>

        <ul className="cap-stack" data-gap="3">
          {FEATURES.map((f) => (
            <li key={f} className="fx-paywall-row-2">
              <span aria-hidden="true" className="fx-mark">
                +
              </span>
              {f}
            </li>
          ))}
        </ul>

        <PlanChoice
          name="plan"
          className="fx-paywall-plans"
          hideLegend
          legend="Choose a Foxing Plus plan"
          value={plan}
          onChange={(v) => setPlan(v as Plan)}
          options={(Object.keys(PLANS) as Plan[]).map((key) => ({
            value: key,
            name: PLANS[key].label,
            price: PLANS[key].price,
            note: PLANS[key].note,
          }))}
        />

        <div className="cap-stack" data-gap="4">
          <div className="cap-stack" data-gap="3">
            <button
              type="button"
              onClick={() => void startTrial()}
              disabled={pending}
              className="cap-btn fx-paywall-btn-2"
              data-variant="primary"
              data-size="lg"
            >
              {pending ? "Starting..." : "Start free 7-day trial"}
            </button>
            <p className="cap-text fx-paywall-text-2" data-align="center">
              No charge until trial ends. Cancel anytime.
            </p>
          </div>

          {error ? (
            <p className="cap-text fx-paywall-text-3" data-align="center" role="alert">
              {error}
            </p>
          ) : null}

          <p className="cap-text fx-paywall-text-2" data-align="center">
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
      {/* Last in the order, as Capsomer's Close is, so opening focuses the chosen plan. */}
      <DialogClose label="Dismiss" className="fx-paywall-btn" />
    </Dialog>
  );
}
