// Validator for POST /api/v1/billing/checkout. The client sends only the plan choice;
// the server maps it to a Stripe price id (never trusts a client-supplied price).
import { z } from "zod";

export const billingCheckoutInput = z.object({
  plan: z.enum(["monthly", "annual"]),
});
export type BillingCheckoutInput = z.infer<typeof billingCheckoutInput>;
