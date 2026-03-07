import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import type Stripe from "stripe";
import { logError } from "@/lib/error-logger";

// Webhook route must read raw body — do NOT use JSON parsing middleware.
// next.js App Router streams the body; we read it as text for signature verification.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret is not configured", { status: 500 });
  }
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    // Return a generic message — Stripe SDK internals (err.message) may leak
    // implementation details that help an attacker craft valid-looking payloads.
    return new Response("Webhook signature verification failed", {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        if (!orgId) break;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: "pro",
            stripeSubscriptionId: session.subscription as string,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        // Find org by Stripe customer ID
        await prisma.organization.updateMany({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan: "free",
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";

        await prisma.organization.updateMany({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan: isActive ? "pro" : "free",
            stripeSubscriptionId: isActive ? subscription.id : null,
          },
        });
        break;
      }

      default:
        // Unhandled event type — ignore silently (Stripe will retry)
        break;
    }
  } catch (err) {
    logError("[stripe/webhook] handler error:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
