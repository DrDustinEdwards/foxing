// The client sends only the plan choice; the server maps it to a Stripe price id, never trusting a client-supplied price.
import { z } from "zod";

export const billingCheckoutInput = z.object({
  plan: z.enum(["monthly", "annual"]),
});
export type BillingCheckoutInput = z.infer<typeof billingCheckoutInput>;
