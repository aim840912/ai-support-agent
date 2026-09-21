/**
 * Seed script for development/demo data.
 * Mirrors the structure from src/lib/ai/mock-data/ but persists to Postgres.
 *
 * Run: pnpm prisma db seed
 *
 * Idempotency strategy:
 *   - Products / Orders / Tickets / AgentSettings → upsert by unique field
 *     The unique keys (sku, orderNumber, ticketNumber) are GLOBAL, not per org,
 *     so the update branch re-assigns orgId. With `update: {}` a row already
 *     owned by another org was silently left there — which is how the demo
 *     org ended up empty after the demo account changed (2026-03-24).
 *   - Documents / ChatSessions / TicketNotes → count-check before inserting (skip if already exist)
 */
import { PrismaClient } from "../src/generated/prisma";
import { PrismaNeon } from "@prisma/adapter-neon";
import { readFileSync } from "fs";
import { resolve } from "path";
import { generateApiKey, hashApiKey } from "../src/lib/api-key";

const DEMO_EMAIL = "demo@ai-support-agent.local";

// Load .env.local so seed can access DATABASE_URL in local development
try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // rely on environment variables already set
}

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Returns a Date N days before today at the given UTC hour. */
function makeDate(daysAgo: number, hour = 12): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

// ── Conversation templates ─────────────────────────────────────────────────
// Each is a list of messages for a realistic support exchange.
// toolCalls format: [{ toolName: string }] — matches analytics/route.ts parser.

type Msg = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { toolName: string }[];
};

const TEMPLATES: Msg[][] = [
  // 0: Order status — delivered
  [
    { role: "user", content: "Hi, can you check the status of my order ORD-001?" },
    {
      role: "assistant",
      content:
        "Your order ORD-001 was delivered on January 15th. Tracking number: 1Z999AA10123456784. Is there anything else I can help with?",
      toolCalls: [{ toolName: "getOrderStatus" }],
    },
    { role: "user", content: "Perfect, thank you!" },
    {
      role: "assistant",
      content: "You're welcome! Feel free to reach out if you need anything else.",
    },
  ],

  // 1: Return policy inquiry
  [
    { role: "user", content: "What is your return policy?" },
    {
      role: "assistant",
      content:
        "Our return policy allows returns within 30 days of delivery for a full refund, provided the item is in its original condition and packaging.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "What if the packaging was damaged during shipping?" },
    {
      role: "assistant",
      content:
        "If the packaging was damaged during shipping, you're still eligible for a return. Please photograph the damage and include the images with your return request.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Great, thanks for clarifying!" },
    { role: "assistant", content: "Happy to help! Let me know if you need anything else." },
  ],

  // 2: Stock check
  [
    { role: "user", content: "Do you have the Wireless Noise-Cancelling Headphones in stock?" },
    {
      role: "assistant",
      content:
        "Yes! The Wireless Noise-Cancelling Headphones are in stock with 45 units available at $299.99. Would you like to place an order?",
      toolCalls: [{ toolName: "checkInventory" }],
    },
    { role: "user", content: "How long does shipping take?" },
    {
      role: "assistant",
      content:
        "Standard shipping takes 3–5 business days. Express shipping (1–2 days) is also available at checkout for an additional fee.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "I'll go ahead and order. Thanks!" },
    {
      role: "assistant",
      content: "Wonderful! Enjoy your new headphones. Reach out anytime if you have questions.",
    },
  ],

  // 3: Damaged item — create ticket
  [
    { role: "user", content: "I received a damaged product in my order ORD-006." },
    {
      role: "assistant",
      content: "I'm very sorry to hear that! Let me create a support ticket for you right away.",
    },
    {
      role: "assistant",
      content:
        "Ticket TKT-1001 has been created for your damaged item report. Our support team will reach out within 24 hours to arrange a replacement or refund. Please keep your reference number handy.",
      toolCalls: [{ toolName: "createTicket" }],
    },
    { role: "user", content: "Thank you for handling this so quickly." },
    {
      role: "assistant",
      content: "Of course! We sincerely apologize for the inconvenience and will make this right.",
    },
  ],

  // 4: Tracking number request
  [
    { role: "user", content: "Can I get the tracking number for order ORD-002?" },
    {
      role: "assistant",
      content:
        "Your order ORD-002 is currently shipped. Tracking number: 1Z999AA10123456785. Estimated delivery: January 20th.",
      toolCalls: [{ toolName: "getOrderStatus" }],
    },
    { role: "user", content: "Thanks, I'll check the carrier website." },
    {
      role: "assistant",
      content: "Sure! You can track it at ups.com. Let me know if you run into any issues.",
    },
  ],

  // 5: Warranty inquiry
  [
    { role: "user", content: "What warranty comes with the wireless headphones?" },
    {
      role: "assistant",
      content:
        "The Wireless Noise-Cancelling Headphones include a 1-year limited manufacturer warranty covering defects in materials and workmanship.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Does it cover accidental drops?" },
    {
      role: "assistant",
      content:
        "Accidental damage isn't covered under the standard warranty. However, we offer an optional extended protection plan at checkout that covers drops and spills.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Good to know, I'll look into the extended plan. Thanks!" },
    { role: "assistant", content: "Great choice! The extended plan gives full peace of mind." },
  ],

  // 6: Product comparison (searchKnowledgeBase + checkInventory)
  [
    {
      role: "user",
      content: "What's the difference between the Mechanical Keyboard and the Wireless Keyboard?",
    },
    {
      role: "assistant",
      content:
        "The Mechanical Keyboard (RGB) features tactile switches with full RGB backlighting — ideal for gaming and heavy typing. The Wireless Keyboard offers quiet keystrokes and Bluetooth connectivity, perfect for office use.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Are both currently in stock?" },
    {
      role: "assistant",
      content:
        "The Mechanical Keyboard has 12 units available ($149.99). The Wireless Keyboard is low stock with only 4 units remaining ($129.99) — I'd recommend ordering soon!",
      toolCalls: [{ toolName: "checkInventory" }],
    },
    { role: "user", content: "I'll grab the wireless one. Thanks!" },
    {
      role: "assistant",
      content: "Great pick! Don't wait too long — those 4 units won't last. Happy shopping!",
    },
  ],

  // 7: Technical support → create ticket
  [
    { role: "user", content: "My USB-C Hub isn't being detected by my MacBook." },
    {
      role: "assistant",
      content:
        "Let's troubleshoot: 1) Try a different USB-C port on your MacBook. 2) Restart your Mac. 3) Test the hub with another device. 4) Reset the SMC if on an Intel Mac.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "I tried all of those — still not working." },
    {
      role: "assistant",
      content:
        "I've created a technical support ticket for you. A specialist will reach out within 24 hours. Keep the hub's serial number handy for the technician.",
      toolCalls: [{ toolName: "createTicket" }],
    },
    {
      role: "user",
      content: "Sounds good. Will they be able to arrange a replacement if it's defective?",
    },
    {
      role: "assistant",
      content:
        "Yes, if the hub is confirmed defective within the warranty period, we'll process a no-questions-asked replacement.",
    },
  ],

  // 8: Shipping time inquiry
  [
    { role: "user", content: "How long will shipping take for my next order?" },
    {
      role: "assistant",
      content:
        "Standard shipping takes 3–5 business days from when your order is processed. Express shipping (1–2 business days) is available for an additional $12.99.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Do you ship to Canada?" },
    {
      role: "assistant",
      content:
        "Yes! We ship to Canada, the US, UK, and select EU countries. Canadian orders typically arrive in 5–7 business days and may be subject to customs duties.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Perfect, I'm in Toronto so that works great." },
    {
      role: "assistant",
      content: "Wonderful! Toronto usually sees delivery in the 5-day range. Happy shopping!",
    },
  ],

  // 9: Simple greeting / widget test
  [
    { role: "user", content: "Hello!" },
    {
      role: "assistant",
      content: "Hello! Welcome to TechGear Support. How can I help you today?",
    },
    { role: "user", content: "Just testing the chat widget." },
    {
      role: "assistant",
      content:
        "Chat is working perfectly! Feel free to ask any questions about orders, products, or returns whenever you're ready.",
    },
  ],

  // 10: Refund status → create ticket
  [
    { role: "user", content: "I returned my order last week. When will I get my refund?" },
    {
      role: "assistant",
      content:
        "Refunds are typically processed within 5–7 business days after we receive your return. The amount will appear on your original payment method.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "It's already been 8 days and nothing has appeared." },
    {
      role: "assistant",
      content:
        "I apologize for the delay. I've created an urgent refund inquiry ticket for you. Our billing team will investigate and provide an update within 24 hours.",
      toolCalls: [{ toolName: "createTicket" }],
    },
    { role: "user", content: "Thank you for escalating this." },
    {
      role: "assistant",
      content: "Of course — we're sorry for the inconvenience and will resolve this promptly.",
    },
  ],

  // 11: Account password reset
  [
    { role: "user", content: "How do I reset my account password?" },
    {
      role: "assistant",
      content:
        "To reset your password: click 'Forgot Password' on the login page, enter your registered email, and follow the link in your inbox. The link expires after 24 hours.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "I didn't receive the email." },
    {
      role: "assistant",
      content:
        "Please check your spam or junk folder. If it's not there, wait 5 minutes and try again. If the issue persists, our support team can manually assist with your account.",
    },
    { role: "user", content: "Found it in spam — all good now!" },
    {
      role: "assistant",
      content:
        "Great! You may want to whitelist our email address to prevent future emails going to spam.",
    },
  ],

  // 12: SHOWCASE — multi-tool conversation (order + inventory × 2 + ticket)
  [
    { role: "user", content: "Hi! Can you check the status of my order ORD-001?" },
    {
      role: "assistant",
      content:
        "Great news! Your order ORD-001 has been delivered. It arrived on January 15th via tracking number 1Z999AA10123456784.",
      toolCalls: [{ toolName: "getOrderStatus" }],
    },
    {
      role: "user",
      content: "Excellent! Do you have the Wireless Keyboard in stock? I need another one.",
    },
    {
      role: "assistant",
      content:
        "The Wireless Keyboard (KB-WL-02) currently has 4 units available at $129.99. Stock is low — I'd recommend ordering soon!",
      toolCalls: [{ toolName: "checkInventory" }],
    },
    { role: "user", content: "What about the Standing Desk Mat?" },
    {
      role: "assistant",
      content:
        "Unfortunately, the Standing Desk Mat (MAT-STAND-BLK) is currently out of stock. I can set up a back-in-stock notification for you.",
      toolCalls: [{ toolName: "checkInventory" }],
    },
    { role: "user", content: "Yes please, sign me up for the notification!" },
    {
      role: "assistant",
      content:
        "Done! I've created a back-in-stock notification request. We'll email you as soon as the Standing Desk Mat is available again. Is there anything else I can help with?",
      toolCalls: [{ toolName: "createTicket" }],
    },
    { role: "user", content: "That's everything — thank you so much!" },
    {
      role: "assistant",
      content:
        "My pleasure! Have a great day, and enjoy your new Wireless Keyboard when it arrives!",
    },
  ],

  // 13: Price match inquiry
  [
    {
      role: "user",
      content: "I found the same webcam cheaper at another store. Do you price match?",
    },
    {
      role: "assistant",
      content:
        "Yes! We offer price matching for identical products from authorized retailers. Submit a price match request with a link to the competitor's listing and we'll review it within 24 hours.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "What's the process for submitting it?" },
    {
      role: "assistant",
      content:
        "Go to your account dashboard, click 'Price Match Request,' enter the product name and competitor URL, then submit. If approved, you'll receive a discount code or refund for the difference.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Perfect, I'll do that now. Thanks!" },
    {
      role: "assistant",
      content: "Good luck! Price matches are usually approved within a few hours.",
    },
  ],

  // 14: Order cancellation (getOrderStatus + createTicket)
  [
    { role: "user", content: "Can I cancel my order ORD-004? It hasn't shipped yet." },
    {
      role: "assistant",
      content:
        "Order ORD-004 is currently in 'pending' status and hasn't shipped yet. I can submit a cancellation request for you right away.",
      toolCalls: [{ toolName: "getOrderStatus" }],
    },
    { role: "user", content: "Yes, please cancel it." },
    {
      role: "assistant",
      content:
        "Cancellation request submitted! You'll receive a confirmation email within 1 hour and a full refund within 3–5 business days.",
      toolCalls: [{ toolName: "createTicket" }],
    },
    { role: "user", content: "Thanks for the quick response!" },
    {
      role: "assistant",
      content:
        "Of course! Sorry the order didn't work out — feel free to shop with us again anytime.",
    },
  ],

  // 15: Webcam setup guide
  [
    { role: "user", content: "How do I set up my new 4K Webcam?" },
    {
      role: "assistant",
      content:
        "Setup is straightforward: 1) Connect via USB-C (or use the included USB-A adapter). 2) The camera is plug-and-play on Windows 10/11 and macOS 12+. 3) Select it as your camera in your video conferencing app.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "Does it work with Zoom and Microsoft Teams?" },
    {
      role: "assistant",
      content:
        "Yes, the 4K Webcam is fully compatible with Zoom, Microsoft Teams, Google Meet, and all major video conferencing platforms.",
      toolCalls: [{ toolName: "searchKnowledgeBase" }],
    },
    { role: "user", content: "That's exactly what I needed. Thanks!" },
    {
      role: "assistant",
      content:
        "Enjoy your new webcam! The 4K resolution makes a noticeable difference in video call quality.",
    },
  ],
];

// ── Session plan: 50 sessions over 30 days ────────────────────────────────
// source: widget (30) | dashboard (12) | api (8)
// visitorSuffix: used for widget sessions ("visitor-001" etc.)
// templateIdx: which conversation template to use

type SessionPlanEntry = {
  daysAgo: number;
  hour: number;
  source: "widget" | "dashboard" | "api";
  visitorSuffix?: number;
  templateIdx: number;
};

const SESSION_PLAN: SessionPlanEntry[] = [
  // ── Last 7 days (15 sessions) ──
  { daysAgo: 0, hour: 9, source: "widget", visitorSuffix: 1, templateIdx: 12 }, // SHOWCASE
  { daysAgo: 0, hour: 14, source: "dashboard", templateIdx: 0 },
  { daysAgo: 1, hour: 10, source: "widget", visitorSuffix: 2, templateIdx: 1 },
  { daysAgo: 1, hour: 15, source: "api", templateIdx: 4 },
  { daysAgo: 2, hour: 9, source: "widget", visitorSuffix: 3, templateIdx: 2 },
  { daysAgo: 2, hour: 13, source: "dashboard", templateIdx: 6 },
  { daysAgo: 3, hour: 11, source: "widget", visitorSuffix: 4, templateIdx: 3 },
  { daysAgo: 3, hour: 16, source: "widget", visitorSuffix: 5, templateIdx: 7 },
  { daysAgo: 4, hour: 10, source: "widget", visitorSuffix: 6, templateIdx: 8 },
  { daysAgo: 4, hour: 14, source: "dashboard", templateIdx: 5 },
  { daysAgo: 5, hour: 9, source: "widget", visitorSuffix: 7, templateIdx: 10 },
  { daysAgo: 5, hour: 15, source: "api", templateIdx: 0 },
  { daysAgo: 6, hour: 11, source: "widget", visitorSuffix: 8, templateIdx: 11 },
  { daysAgo: 6, hour: 16, source: "widget", visitorSuffix: 9, templateIdx: 9 },
  { daysAgo: 7, hour: 10, source: "dashboard", templateIdx: 14 },
  // ── 8–14 days ago (12 sessions) ──
  { daysAgo: 7, hour: 15, source: "widget", visitorSuffix: 10, templateIdx: 13 },
  { daysAgo: 8, hour: 9, source: "widget", visitorSuffix: 11, templateIdx: 15 },
  { daysAgo: 8, hour: 14, source: "dashboard", templateIdx: 2 },
  { daysAgo: 9, hour: 11, source: "widget", visitorSuffix: 12, templateIdx: 1 },
  { daysAgo: 9, hour: 16, source: "api", templateIdx: 4 },
  { daysAgo: 10, hour: 10, source: "widget", visitorSuffix: 13, templateIdx: 6 },
  { daysAgo: 11, hour: 9, source: "widget", visitorSuffix: 14, templateIdx: 0 },
  { daysAgo: 11, hour: 13, source: "dashboard", templateIdx: 10 },
  { daysAgo: 12, hour: 11, source: "widget", visitorSuffix: 15, templateIdx: 8 },
  { daysAgo: 12, hour: 15, source: "api", templateIdx: 5 },
  { daysAgo: 13, hour: 10, source: "widget", visitorSuffix: 16, templateIdx: 3 },
  { daysAgo: 14, hour: 9, source: "dashboard", templateIdx: 7 },
  // ── 15–21 days ago (10 sessions) ──
  { daysAgo: 14, hour: 14, source: "widget", visitorSuffix: 17, templateIdx: 13 },
  { daysAgo: 15, hour: 11, source: "api", templateIdx: 2 },
  { daysAgo: 15, hour: 16, source: "widget", visitorSuffix: 18, templateIdx: 11 },
  { daysAgo: 16, hour: 9, source: "widget", visitorSuffix: 19, templateIdx: 1 },
  { daysAgo: 17, hour: 10, source: "dashboard", templateIdx: 14 },
  { daysAgo: 18, hour: 13, source: "widget", visitorSuffix: 20, templateIdx: 9 },
  { daysAgo: 19, hour: 9, source: "widget", visitorSuffix: 21, templateIdx: 15 },
  { daysAgo: 19, hour: 15, source: "api", templateIdx: 0 },
  { daysAgo: 20, hour: 11, source: "widget", visitorSuffix: 22, templateIdx: 6 },
  { daysAgo: 21, hour: 14, source: "dashboard", templateIdx: 4 },
  // ── 22–30 days ago (13 sessions) ──
  { daysAgo: 22, hour: 10, source: "widget", visitorSuffix: 23, templateIdx: 2 },
  { daysAgo: 22, hour: 15, source: "widget", visitorSuffix: 24, templateIdx: 5 },
  { daysAgo: 23, hour: 9, source: "dashboard", templateIdx: 10 },
  { daysAgo: 24, hour: 11, source: "widget", visitorSuffix: 25, templateIdx: 8 },
  { daysAgo: 24, hour: 16, source: "api", templateIdx: 3 },
  { daysAgo: 25, hour: 10, source: "widget", visitorSuffix: 26, templateIdx: 1 },
  { daysAgo: 25, hour: 14, source: "widget", visitorSuffix: 27, templateIdx: 13 },
  { daysAgo: 26, hour: 9, source: "dashboard", templateIdx: 7 },
  { daysAgo: 27, hour: 11, source: "widget", visitorSuffix: 28, templateIdx: 15 },
  { daysAgo: 27, hour: 15, source: "api", templateIdx: 4 },
  { daysAgo: 28, hour: 10, source: "widget", visitorSuffix: 29, templateIdx: 6 },
  { daysAgo: 29, hour: 9, source: "widget", visitorSuffix: 30, templateIdx: 0 },
  { daysAgo: 30, hour: 14, source: "dashboard", templateIdx: 2 },
];

async function main() {
  console.log("Seeding database...");

  // Find or create a dedicated demo org + user.
  // Using a fixed email ensures idempotency — re-running seed never duplicates data.
  let demoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!demoUser) {
    console.log(`Creating demo user (${DEMO_EMAIL})...`);
    const rawApiKey = generateApiKey();

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: "TechGear Store",
          apiKey: rawApiKey,
          apiKeyHash: hashApiKey(rawApiKey),
        },
      });
      const user = await tx.user.create({
        data: {
          email: DEMO_EMAIL,
          name: "Demo User",
          // No password — auth bypass in auth.config.ts authorize()
          emailVerified: new Date(),
          orgId: org.id,
          activeOrgId: org.id,
          role: "owner",
        },
      });
      await tx.userOrganization.create({
        data: { userId: user.id, orgId: org.id, role: "owner" },
      });
      return { org, user };
    });

    demoUser = result.user;

    console.log(`\n${"─".repeat(60)}`);
    console.log(`  Demo user created: ${DEMO_EMAIL}`);
    console.log(`  Demo API key:      ${rawApiKey}`);
    console.log(`\n  To enable the landing page widget demo, add to .env.local:`);
    console.log(`  NEXT_PUBLIC_DEMO_API_KEY=${rawApiKey}`);
    console.log(`${"─".repeat(60)}\n`);
  } else {
    console.log(`Demo user already exists (${DEMO_EMAIL}) — skipping user creation`);
  }

  const org = await prisma.organization.findUnique({
    where: { id: demoUser.orgId! },
  });

  if (!org) {
    console.error("Demo org not found. This should not happen.");
    return;
  }

  console.log(`Seeding data for org: ${org.name} (${org.id})`);

  // Use demo user as authorId for TicketNotes and dashboard session userId
  const firstUser = demoUser;

  // ── Upgrade org to pro plan ──────────────────────────────────────────────
  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: "pro" },
  });
  console.log("Upgraded org to pro plan");

  // ── AgentSettings ────────────────────────────────────────────────────────
  await prisma.agentSettings.upsert({
    where: { orgId: org.id },
    update: {
      enabledTools: ["searchKnowledgeBase", "getOrderStatus", "checkInventory", "createTicket"],
    },
    create: {
      orgId: org.id,
      welcomeMessage: "Hello! I'm your AI support assistant. How can I help you today?",
      systemPrompt:
        "You are a helpful customer support AI assistant for TechGear Store. Be concise, friendly, and professional. Always verify order details before providing information.",
      enabledTools: ["searchKnowledgeBase", "getOrderStatus", "checkInventory", "createTicket"],
      theme: { primaryColor: "#2563eb" },
    },
  });
  console.log("Upserted AgentSettings");

  // ── Products (8 total) ───────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: "AUDIO-WNC-BLK" },
      update: { orgId: org.id },
      create: {
        name: "Wireless Noise-Cancelling Headphones",
        sku: "AUDIO-WNC-BLK",
        stockLevel: 45,
        warehouse: "WH-West",
        reorderThreshold: 10,
        price: 299.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "KB-MECH-RGB" },
      update: { orgId: org.id },
      create: {
        name: "Mechanical Keyboard (RGB)",
        sku: "KB-MECH-RGB",
        stockLevel: 12,
        warehouse: "WH-East",
        reorderThreshold: 15, // stockLevel 12 < threshold 15 → Low badge
        price: 149.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "HUB-USBC-7P" },
      update: { orgId: org.id },
      create: {
        name: "USB-C Hub 7-in-1",
        sku: "HUB-USBC-7P",
        stockLevel: 78,
        warehouse: "WH-Central",
        reorderThreshold: 20,
        price: 49.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "MOUSE-ERG-GRY" },
      update: { orgId: org.id },
      create: {
        name: "Ergonomic Mouse",
        sku: "MOUSE-ERG-GRY",
        stockLevel: 3,
        warehouse: "WH-West",
        reorderThreshold: 10, // stockLevel 3 < threshold 10 → Low badge
        price: 79.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "MAT-STAND-BLK" },
      update: { orgId: org.id },
      create: {
        name: "Standing Desk Mat",
        sku: "MAT-STAND-BLK",
        stockLevel: 0,
        warehouse: "WH-East",
        reorderThreshold: 5, // stockLevel 0 → Out of Stock
        price: 59.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "CAM-4K-USB" },
      update: { orgId: org.id },
      create: {
        name: "4K Webcam",
        sku: "CAM-4K-USB",
        stockLevel: 28,
        warehouse: "WH-Central",
        reorderThreshold: 8,
        price: 199.99,
        orgId: org.id,
      },
    }),
    // New products
    prisma.product.upsert({
      where: { sku: "KB-WL-02" },
      update: { orgId: org.id },
      create: {
        name: "Wireless Keyboard",
        sku: "KB-WL-02",
        stockLevel: 4,
        warehouse: "WH-East",
        reorderThreshold: 10, // stockLevel 4 < threshold 10 → Low badge
        price: 129.99,
        orgId: org.id,
      },
    }),
    prisma.product.upsert({
      where: { sku: "LIGHT-LED-DK" },
      update: { orgId: org.id },
      create: {
        name: "LED Desk Lamp",
        sku: "LIGHT-LED-DK",
        stockLevel: 52,
        warehouse: "WH-Central",
        reorderThreshold: 12,
        price: 39.99,
        orgId: org.id,
      },
    }),
  ]);

  const [headphones, keyboard, hub, mouse, mat, webcam, wirelessKeyboard, deskLamp] = products;

  console.log(`Seeded ${products.length} products`);

  // ── Orders (10 total) ────────────────────────────────────────────────────
  const orders = await Promise.all([
    // ── Existing 6 ──
    prisma.order.upsert({
      where: { orderNumber: "ORD-001" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-001",
        status: "delivered",
        trackingNumber: "1Z999AA10123456784",
        estimatedDelivery: new Date("2024-01-15"),
        totalPrice: 299.99,
        customerId: "CUST-001",
        orgId: org.id,
        createdAt: new Date("2024-01-10"),
        items: {
          create: { productId: headphones.id, quantity: 1, unitPrice: 299.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-002" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-002",
        status: "shipped",
        trackingNumber: "1Z999AA10123456785",
        estimatedDelivery: new Date("2024-01-20"),
        totalPrice: 149.99,
        customerId: "CUST-002",
        orgId: org.id,
        createdAt: new Date("2024-01-16"),
        items: {
          create: { productId: keyboard.id, quantity: 1, unitPrice: 149.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-003" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-003",
        status: "processing",
        estimatedDelivery: new Date("2024-01-22"),
        totalPrice: 99.98,
        customerId: "CUST-003",
        orgId: org.id,
        createdAt: new Date("2024-01-18"),
        items: {
          create: { productId: hub.id, quantity: 2, unitPrice: 49.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-004" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-004",
        status: "pending",
        totalPrice: 79.99,
        customerId: "CUST-004",
        orgId: org.id,
        createdAt: new Date("2024-01-19"),
        items: {
          create: { productId: mouse.id, quantity: 1, unitPrice: 79.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-005" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-005",
        status: "cancelled",
        totalPrice: 59.99,
        customerId: "CUST-005",
        orgId: org.id,
        createdAt: new Date("2024-01-12"),
        items: {
          create: { productId: mat.id, quantity: 1, unitPrice: 59.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-006" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-006",
        status: "shipped",
        trackingNumber: "1Z999AA10123456786",
        estimatedDelivery: new Date("2024-01-21"),
        totalPrice: 199.99,
        customerId: "CUST-001",
        orgId: org.id,
        createdAt: new Date("2024-01-17"),
        items: {
          create: { productId: webcam.id, quantity: 1, unitPrice: 199.99 },
        },
      },
    }),
    // ── New orders ──
    prisma.order.upsert({
      where: { orderNumber: "ORD-007" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-007",
        status: "pending",
        totalPrice: 179.98,
        customerId: "CUST-006",
        orgId: org.id,
        createdAt: makeDate(5, 10),
        items: {
          create: [
            { productId: wirelessKeyboard.id, quantity: 1, unitPrice: 129.99 },
            { productId: hub.id, quantity: 1, unitPrice: 49.99 },
          ],
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-008" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-008",
        status: "processing",
        estimatedDelivery: makeDate(-3), // estimated 3 days from now
        totalPrice: 199.99,
        customerId: "CUST-007",
        orgId: org.id,
        createdAt: makeDate(3, 14),
        items: {
          create: { productId: webcam.id, quantity: 1, unitPrice: 199.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-009" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-009",
        status: "delivered",
        trackingNumber: "1Z999AA10123456787",
        estimatedDelivery: makeDate(8),
        totalPrice: 259.98,
        customerId: "CUST-008",
        orgId: org.id,
        createdAt: makeDate(14, 9),
        items: {
          create: { productId: wirelessKeyboard.id, quantity: 2, unitPrice: 129.99 },
        },
      },
    }),
    prisma.order.upsert({
      where: { orderNumber: "ORD-010" },
      update: { orgId: org.id },
      create: {
        orderNumber: "ORD-010",
        status: "cancelled",
        totalPrice: 119.98,
        customerId: "CUST-009",
        orgId: org.id,
        createdAt: makeDate(20, 11),
        items: {
          create: { productId: mat.id, quantity: 2, unitPrice: 59.99 },
        },
      },
    }),
  ]);

  // Friendly aliases for ticket orderId references
  const [ord001, ord002, , , ord005, ord006, ord007] = orders;

  console.log(`Seeded ${orders.length} orders`);

  // ── Tickets (8 total) ────────────────────────────────────────────────────
  const tickets = await Promise.all([
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1000" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1000",
        subject: "Headphones not pairing with MacBook",
        description:
          "Cannot pair the Wireless Noise-Cancelling Headphones with MacBook Pro via Bluetooth. Have tried resetting the device multiple times.",
        priority: "medium",
        status: "in_progress",
        orderId: orders[0].id,
        orgId: org.id,
        createdAt: makeDate(4, 11),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1001" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1001",
        subject: "Received damaged product — webcam lens cracked",
        description:
          "I received my 4K Webcam from order ORD-006 and the lens is visibly cracked. The packaging also appeared damaged. This is unacceptable and I need a replacement urgently.",
        priority: "high",
        status: "open",
        orderId: ord006.id,
        orgId: org.id,
        createdAt: makeDate(2, 11),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1002" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1002",
        subject: "Wrong item shipped — received wrong keyboard model",
        description:
          "Order ORD-002 contained a standard keyboard instead of the Mechanical Keyboard (RGB) I ordered. I need the correct item shipped as soon as possible.",
        priority: "urgent",
        status: "open",
        orderId: ord002.id,
        orgId: org.id,
        createdAt: makeDate(15, 9),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1003" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1003",
        subject: "Question about extended warranty coverage",
        description:
          "Does the extended warranty plan cover accidental drops and liquid spills? I want to understand the full coverage before purchasing.",
        priority: "low",
        status: "resolved",
        orderId: null,
        orgId: org.id,
        createdAt: makeDate(22, 14),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1004" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1004",
        subject: "Request to add item to existing order",
        description:
          "I'd like to add one more USB-C Hub to order ORD-003 before it ships. Is this possible at the processing stage?",
        priority: "medium",
        status: "closed",
        orderId: orders[2].id,
        orgId: org.id,
        createdAt: makeDate(18, 10),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1005" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1005",
        subject: "Headphones stopped working after firmware update",
        description:
          "After applying the latest firmware update via the companion app, my headphones no longer connect to any device. Tried factory reset with no success. Order ORD-001.",
        priority: "high",
        status: "in_progress",
        orderId: ord001.id,
        orgId: org.id,
        createdAt: makeDate(5, 16),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1006" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1006",
        subject: "Order ORD-007 still pending after 5 days",
        description:
          "I placed order ORD-007 five days ago and it's still showing as 'pending'. No shipping confirmation received. Can you provide an update on when this will ship?",
        priority: "urgent",
        status: "in_progress",
        orderId: ord007.id,
        orgId: org.id,
        createdAt: makeDate(3, 9),
      },
    }),
    prisma.ticket.upsert({
      where: { ticketNumber: "TKT-1007" },
      update: { orgId: org.id },
      create: {
        ticketNumber: "TKT-1007",
        subject: "Refund not received for returned order ORD-005",
        description:
          "I returned the Standing Desk Mat from order ORD-005 over two weeks ago. The return was confirmed received but I still haven't seen the refund on my credit card.",
        priority: "low",
        status: "open",
        orderId: ord005.id,
        orgId: org.id,
        createdAt: makeDate(6, 13),
      },
    }),
  ]);

  console.log(`Seeded ${tickets.length} tickets`);

  // ── TicketNotes ──────────────────────────────────────────────────────────
  const noteAuthorId = firstUser?.id ?? "system-seed";
  const hasNotes = (await prisma.ticketNote.count({ where: { ticket: { orgId: org.id } } })) > 0;

  if (!hasNotes) {
    await prisma.ticketNote.createMany({
      data: [
        // TKT-1000 (in_progress)
        {
          content:
            "Customer confirmed the issue started after the latest macOS 14.3 update. Reproducing in-house. Escalating to firmware team.",
          authorId: noteAuthorId,
          ticketId: tickets[0].id,
          createdAt: makeDate(4, 11),
        },
        {
          content:
            "Firmware team identified a Bluetooth stack regression in v2.4.1. Hotfix in progress, ETA 48 hours. Will notify customer.",
          authorId: noteAuthorId,
          ticketId: tickets[0].id,
          createdAt: makeDate(3, 15),
        },
        // TKT-1001 (open — damaged webcam)
        {
          content:
            "Customer sent photos. Damage is consistent with rough handling during transit, not manufacturing defect. Approved immediate replacement. Notified warehouse.",
          authorId: noteAuthorId,
          ticketId: tickets[1].id,
          createdAt: makeDate(1, 10),
        },
        // TKT-1002 (open — wrong item)
        {
          content:
            "Investigated with warehouse. Confirmed picking error on ORD-002 — wrong SKU scanned at dispatch. Sending correct Mechanical Keyboard (RGB) via express, 1–2 day delivery.",
          authorId: noteAuthorId,
          ticketId: tickets[2].id,
          createdAt: makeDate(14, 14),
        },
        // TKT-1004 (closed)
        {
          content:
            "Order ORD-003 has already entered processing and cannot be modified. Advised customer to place a new order for the additional hub. Ticket closed.",
          authorId: noteAuthorId,
          ticketId: tickets[4].id,
          createdAt: makeDate(17, 9),
        },
        // TKT-1005 (in_progress — headphone firmware)
        {
          content:
            "Reproduced the connectivity failure after v2.4.1 firmware update. Sent customer a manual rollback guide (v2.3.8). Awaiting confirmation.",
          authorId: noteAuthorId,
          ticketId: tickets[5].id,
          createdAt: makeDate(4, 11),
        },
        {
          content:
            "Customer confirmed rollback to v2.3.8 restored connectivity. Monitoring for 48 hours. Will close if no regression.",
          authorId: noteAuthorId,
          ticketId: tickets[5].id,
          createdAt: makeDate(3, 16),
        },
        // TKT-1006 (in_progress — order delayed)
        {
          content:
            "ORD-007 held due to address verification flag. Contacted customer for confirmation. Will expedite once verified.",
          authorId: noteAuthorId,
          ticketId: tickets[6].id,
          createdAt: makeDate(2, 10),
        },
        // TKT-1007 (open — refund delay)
        {
          content:
            "Confirmed return received in warehouse. Refund was delayed due to bank processing backlog. Manually escalated to billing team — refund issued today.",
          authorId: noteAuthorId,
          ticketId: tickets[7].id,
          createdAt: makeDate(5, 14),
        },
      ],
    });
    console.log("Seeded TicketNotes");
  } else {
    console.log("TicketNotes already exist — skipping");
  }

  // ── Documents ────────────────────────────────────────────────────────────
  const existingDocCount = await prisma.document.count({ where: { orgId: org.id } });

  if (existingDocCount === 0) {
    await prisma.document.createMany({
      data: [
        {
          orgId: org.id,
          filename: "Return & Refund Policy.pdf",
          status: "ready",
          chunkCount: 12,
          createdAt: makeDate(45, 10),
        },
        {
          orgId: org.id,
          filename: "Product Warranty Guide.pdf",
          status: "ready",
          chunkCount: 8,
          createdAt: makeDate(38, 14),
        },
        {
          orgId: org.id,
          filename: "Shipping & Delivery FAQ.pdf",
          status: "ready",
          chunkCount: 15,
          createdAt: makeDate(30, 9),
        },
        {
          orgId: org.id,
          filename: "Technical Support Guide.pdf",
          status: "ready",
          chunkCount: 22,
          createdAt: makeDate(20, 11),
        },
        {
          orgId: org.id,
          filename: "Account Management Help.pdf",
          status: "ready",
          chunkCount: 6,
          createdAt: makeDate(10, 15),
        },
      ],
    });
    console.log("Seeded 5 Documents");
  } else {
    console.log(`Documents already exist (${existingDocCount}) — skipping`);
  }

  // ── ChatSessions + ChatMessages ──────────────────────────────────────────
  const existingSessionCount = await prisma.chatSession.count({
    where: { orgId: org.id },
  });

  if (existingSessionCount === 0) {
    console.log(`Creating ${SESSION_PLAN.length} ChatSessions...`);

    for (const plan of SESSION_PLAN) {
      const sessionDate = makeDate(plan.daysAgo, plan.hour);
      const messages = TEMPLATES[plan.templateIdx];

      await prisma.chatSession.create({
        data: {
          orgId: org.id,
          source: plan.source,
          // widget sessions use anonymous visitor IDs; dashboard sessions link to a user
          visitorId:
            plan.source === "widget"
              ? `visitor-${String(plan.visitorSuffix ?? 0).padStart(3, "0")}`
              : undefined,
          userId: plan.source === "dashboard" ? (firstUser?.id ?? undefined) : undefined,
          createdAt: sessionDate,
          messages: {
            create: messages.map((msg, idx) => ({
              role: msg.role,
              content: msg.content,
              // Prisma 7: nullable JSON fields require undefined (not null) to omit
              toolCalls: msg.toolCalls ?? undefined,
              // Each message 2 minutes apart within the session
              createdAt: new Date(sessionDate.getTime() + idx * 2 * 60 * 1000),
            })),
          },
        },
      });
    }

    console.log(`Seeded ${SESSION_PLAN.length} ChatSessions`);
  } else {
    console.log(`ChatSessions already exist (${existingSessionCount}) — skipping`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
