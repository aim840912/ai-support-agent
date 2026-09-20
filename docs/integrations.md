# Integrations

Three ways to connect the support agent to something else: a messaging
channel customers talk to, outbound webhooks your tools listen for, and an
MCP server an AI client can query directly.

All three are configured at **Dashboard → Integrations**.

---

## Telegram channel

A Telegram bot that answers with the same agent, tools and transcript as the
website widget. Conversations appear in the dashboard tagged `telegram`.

### Setup

1. Message [@BotFather](https://t.me/BotFather) — **check the verified
   badge**, the search results contain impostor accounts using the same
   display name — and run `/newbot`.
2. Paste the token into **Integrations → Channels**.

The server registers the webhook with Telegram for you. It needs a public
HTTPS address: set `INTEGRATIONS_PUBLIC_URL` if that differs from
`NEXT_PUBLIC_APP_URL`. In local development, a tunnel works:

```bash
cloudflared tunnel --url http://localhost:3000
```

Telegram refuses a non-HTTPS webhook, so `localhost` will not do.

### How it behaves

|                     |                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conversation window | 24 hours. After that a new message starts a fresh conversation, so a user is not pinned to one session against the plan's per-conversation message limit. |
| `/reset`            | Starts a new conversation immediately. Nothing is deleted.                                                                                                |
| Non-text messages   | Answered with a note that only text is read.                                                                                                              |
| Formatting          | Replies are converted to Telegram's HTML subset; if Telegram rejects it, the same text is resent as plain.                                                |

### Design notes

The webhook path contains an opaque random id, **not** the organization id —
that URL is stored on Telegram's servers and appears in logs, so using the
tenant id would broadcast it and make tenants enumerable. Knowing the URL is
not enough to post updates: every request must also carry the secret token
registered with Telegram, compared in constant time.

Enabling the channel always mints a new path and secret. Disabling
unregisters the webhook, so resuming needs a fresh registration — and only
the secret's hash is stored, so the old one could not be reused even if it
were wanted.

Bot tokens are encrypted at rest (AES-256-GCM). See
[Why encrypt bot tokens but not webhook secrets](#why-encrypt-bot-tokens-but-not-webhook-secrets).

---

## Outbound webhooks

An HTTP POST to your own endpoint when the agent creates a support ticket —
to post it in Slack, open a row in a spreadsheet, or start a workflow in n8n
or Zapier.

### Payload

```json
{
  "id": "evt_7Kq2...",
  "event": "ticket.created",
  "createdAt": "2026-09-20T10:11:12.000Z",
  "orgId": "clx...",
  "data": {
    "ticketId": "clx...",
    "ticketNumber": "TKT-1001",
    "subject": "Order ORD-001 hasn't arrived",
    "description": "...",
    "priority": "high",
    "status": "open",
    "slaHours": 4,
    "orderNumber": "ORD-001",
    "source": "agent",
    "createdAt": "2026-09-20T10:11:12.000Z",
    "dashboardUrl": "https://your-app.example/tickets/clx..."
  }
}
```

Envelope fields (`id`, `event`, `orgId`) are separate from `data` so a future
event type cannot collide with a domain field of this one. Everything is a
string or a number — never a `Date` or a `Decimal`, both of which serialise
into shapes that surprise receivers. `slaHours` and `dashboardUrl` are
precomputed so the receiving workflow does not have to re-derive business
rules or assemble URLs.

### Headers

| Header                | Meaning                                    |
| --------------------- | ------------------------------------------ |
| `X-Webhook-Id`        | Unique per event. **Deduplicate on this.** |
| `X-Webhook-Event`     | `ticket.created`                           |
| `X-Webhook-Timestamp` | Unix seconds                               |
| `X-Webhook-Signature` | `t=<unix>,v1=<hex>`                        |

### Verifying

Recompute the HMAC over `` `${timestamp}.${rawBody}` `` — the raw bytes, not
a re-serialised object — and compare in constant time.

```js
const crypto = require("crypto");

function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    header.split(",").map((s) => {
      const i = s.indexOf("=");
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    })
  );
  const { t, v1 } = parts;
  if (!t || !v1) return false;

  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  // timingSafeEqual throws on differing lengths, so check that first.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

`scripts/webhook-receiver.mjs` in this repository is that function wrapped in
a server — run it to check an endpoint end to end:

```bash
node scripts/webhook-receiver.mjs <signing-secret> 5678
```

The timestamp buys replay **resistance**, not prevention: it bounds how long
a captured request stays usable. Prevention requires you to deduplicate on
`X-Webhook-Id`, which is why that header is sent.

### Delivery guarantees

**At-most-a-few-attempts, not at-least-once.** Each event is tried up to
twice within one invocation, four seconds per attempt, retrying only network
failures, 5xx and 429 — a 4xx means the receiver understood and refused.
There is no background worker on this platform and `after()` is not durable,
so a crash loses the event.

A production answer is a durable queue (QStash, Inngest, or a `pending` table
drained by cron). The seam is the `deliverOnce` call inside
`dispatchWebhooks`: replace it with an enqueue and nothing else moves.

Ten consecutive failures disable an endpoint, so a dead URL stops consuming
an attempt on every event. Re-enabling it from the dashboard resets the
count. The last twenty deliveries per endpoint are kept, with the request and
response bodies truncated — enough to debug a field-mapping problem, not an
audit log.

### URL restrictions

Endpoints must be `https://` in production and may not point at loopback or
private address ranges, including the cloud metadata address. Loopback is
permitted in development so a local automation tool can receive events.

The check inspects the literal host, so a public hostname that resolves to a
private address still passes. Closing that requires resolving the name and
pinning the socket, which this project does not do.

---

## MCP server

Exposes the agent's four tools to any MCP client — Claude Desktop, an editor,
your own agent — over Streamable HTTP.

```
https://your-app.example/api/mcp
```

### Setup

1. **Integrations → MCP → Create key.** The key is shown once; only a hash
   and a short prefix are stored.
2. Add it to your client:

```json
{
  "mcpServers": {
    "ai-support-agent": {
      "url": "https://your-app.example/api/mcp",
      "headers": { "Authorization": "Bearer mcp_..." }
    }
  }
}
```

### Tools and plans

| Tool                  | Free | Pro | Writes |
| --------------------- | ---- | --- | ------ |
| `searchKnowledgeBase` | ✅   | ✅  |        |
| `getOrderStatus`      | ✅   | ✅  |        |
| `checkInventory`      |      | ✅  |        |
| `createTicket`        |      | ✅  | ✅     |

Gating applies twice. The tool list is built per request from the
organization's plan, so a free-plan client never _sees_ the other two; and
each call re-checks, so a client holding a cached list cannot invoke them
either. Because the plan is read from the database on every request, an
upgrade takes effect on the next call with nothing to invalidate.

Every tool is scoped to the organization that owns the key. A key for one
tenant querying another tenant's order number returns "not found".

### Why a separate credential

The widget API key (`sk_…`) is **public**: it is printed into the customer's
own web page so the chat widget can authenticate. It is deliberately rejected
by the MCP endpoint, which reads orders and creates tickets. Integration keys
(`mcp_…`) are stored as a hash, revocable individually, and carry a
`lastUsedAt` so an unused key is visible.

---

## Why encrypt bot tokens but not webhook secrets

Different blast radius, not different diligence.

A **Telegram bot token** is a credential for a third-party system. Leaked, it
lets an attacker act as the customer's bot towards the customer's own end
users — damage that happens outside this system, where it can neither be
detected nor stopped from here. Encrypted at rest with AES-256-GCM, keyed by
`INTEGRATION_ENCRYPTION_KEY`, in a versioned envelope so the algorithm can
change without a one-shot migration. A missing key fails fast rather than
falling back to plaintext, because "stored in the clear while everything
reports otherwise" is the worst available state.

A **webhook signing secret** is a symmetric key shared with that same
customer. It must be displayed so they can paste it into their tool, and it
is recomputed in plaintext on every delivery. Encrypting it would buy only
the narrow case of a database leak without an environment leak — the
decryption key lives in the same environment as `DATABASE_URL` — while adding
a failure mode where rotating that key breaks every endpoint at once.

---

## Known limitations

- Webhook delivery is best-effort within a single request (above).
- Rate limiting is in-process. On serverless this limits per warm instance,
  not globally. Acceptable at this scale; Upstash Redis is the upgrade.
- Telegram update deduplication is also per instance. The primary defence is
  answering 200 immediately, which is what keeps Telegram from retrying.
- The webhook URL guard inspects the literal host, not the resolved address.
- Delivery history stores truncated request bodies, which may contain
  customer text from a ticket. A production system should redact or store
  only a schema.
