import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";
import { logError } from "@/lib/error-logger";

export async function POST() {
  const session = await auth();
  if (!session?.user?.orgId || !session.user.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Only owner or admin can initiate an upgrade — members should not be able
  // to trigger billing operations on behalf of the organization.
  if (!["owner", "admin"].includes(session.user.role as string)) {
    return new Response("Insufficient permissions", { status: 403 });
  }

  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!priceId) {
    return new Response("Stripe price ID is not configured", { status: 500 });
  }

  const { orgId, email } = session.user;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, plan: true },
    });

    if (!org) {
      return new Response("Organization not found", { status: 404 });
    }

    // Already on Pro — don't create a second subscription
    if (org.plan === "pro") {
      return Response.json({ error: "Already on Pro plan" }, { status: 400 });
    }

    const stripe = getStripeClient();

    // Reuse existing Stripe customer or create a new one
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { orgId },
      });
      customerId = customer.id;

      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    const origin = process.env.AUTH_URL ?? "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?tab=plan&upgraded=true`,
      cancel_url: `${origin}/settings?tab=plan`,
      metadata: { orgId },
    });

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    logError("[StripeCheckout]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
