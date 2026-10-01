/**
 * Verifies that every free model slug in MODEL_SLUGS still answers a request
 * that carries a tool definition.
 *
 * Why a live call: a dead free slug still appears in /api/v1/models with
 * `supported_parameters: ["tools"]`, so reading the model list proves nothing.
 * The fallbacks are only exercised when the primary is also failing, which is
 * the worst moment to discover they are dead too (2026-09-20, deepseek).
 *
 * Each slug is called on its own, WITHOUT the `models` fallback array —
 * otherwise OpenRouter would silently serve a different model and a dead slug
 * would look healthy.
 *
 * Cost: one request per free slug, counted against the account-wide free
 * quota (50/day, shared with every tenant and the landing demo). The paid
 * `complex` slug is skipped on purpose — the cost guard keeps it unused.
 *
 *   pnpm check:models                    # every free slug in MODEL_SLUGS
 *   pnpm check:models <slug> [<slug>...] # candidates, before adding them
 *
 * Exit code 1 if any slug is dead; rate-limited slugs are reported but do not
 * fail the run, since a 429 says nothing about whether the slug still exists.
 */
import { MODEL_SLUGS } from "../src/lib/ai/model-router.ts";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const candidates = process.argv.slice(2);
const slugs = candidates.length ? candidates : [MODEL_SLUGS.simple, ...MODEL_SLUGS.freeFallbacks];

// Same shape as a real agent tool, so a model that rejects tool calls fails here.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "getOrderStatus",
      description: "Look up an order by its order number",
      parameters: {
        type: "object",
        properties: { orderId: { type: "string" } },
        required: ["orderId"],
      },
    },
  },
];

/** Strips the `:free` variant suffix so the served model can be compared. */
const base = (slug) => slug.replace(/:free$/, "");

async function check(slug) {
  const started = Date.now();
  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: slug,
        messages: [{ role: "user", content: "What is the status of order ORD-001?" }],
        tools: TOOLS,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    return { slug, status: "dead", detail: `request failed: ${error.message}` };
  }

  const ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  const message = body.error?.message ?? "";

  if (res.status === 429 || /rate.?limit/i.test(message)) {
    return { slug, status: "rate-limited", detail: message || "HTTP 429", ms };
  }
  if (!res.ok || body.error || !body.choices?.length) {
    return { slug, status: "dead", detail: message || `HTTP ${res.status}`, ms };
  }
  if (body.model && base(body.model) !== base(slug)) {
    return { slug, status: "dead", detail: `served by ${body.model} instead`, ms };
  }
  return { slug, status: "ok", detail: `served by ${body.model ?? slug}`, ms };
}

// Sequential on purpose: the free tier allows 20 req/min, and a burst would
// turn a healthy slug into a false "rate-limited".
const results = [];
for (const slug of slugs) {
  const r = await check(slug);
  results.push(r);
  const time = r.ms === undefined ? "" : ` (${(r.ms / 1000).toFixed(1)}s)`;
  console.log(`${r.status.padEnd(12)} ${slug}${time} — ${r.detail}`);
}

const dead = results.filter((r) => r.status === "dead");
if (dead.length) {
  console.error(`\n${dead.length} dead slug(s). Update MODEL_SLUGS in src/lib/ai/model-router.ts.`);
  process.exit(1);
}
