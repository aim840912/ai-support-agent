import Stripe from "stripe";

// Lazily initialized to avoid build-time failures when STRIPE_SECRET_KEY
// is absent from the environment (e.g., pnpm build on a CI machine without .env).
// The key is only required at runtime when a Stripe operation is actually performed.
let _client: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _client = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _client;
}
