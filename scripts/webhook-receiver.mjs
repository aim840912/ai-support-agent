/**
 * Minimal webhook receiver for local testing.
 *
 * Implements exactly the verification the Integrations page documents, so
 * running it proves the published snippet is correct rather than plausible.
 *
 *   node scripts/webhook-receiver.mjs <signing-secret> [port]
 */
import { createServer } from "http";
import { createHmac, timingSafeEqual } from "crypto";

const secret = process.argv[2];
const port = Number(process.argv[3] ?? 5678);

if (!secret) {
  console.error("Usage: node scripts/webhook-receiver.mjs <signing-secret> [port]");
  process.exit(1);
}

const TOLERANCE_SECONDS = 300;
const seen = new Set();

function verify(rawBody, header) {
  if (!header) return { valid: false, reason: "missing signature header" };

  const parts = Object.fromEntries(
    header.split(",").map((segment) => {
      const i = segment.indexOf("=");
      return [segment.slice(0, i).trim(), segment.slice(i + 1).trim()];
    })
  );
  const { t, v1 } = parts;
  if (!t || !v1) return { valid: false, reason: "malformed header" };

  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature mismatch" };
  }
  return { valid: true };
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const result = verify(body, req.headers["x-webhook-signature"]);
    const eventId = req.headers["x-webhook-id"];
    const duplicate = eventId ? seen.has(eventId) : false;
    if (eventId) seen.add(eventId);

    const parsed = (() => {
      try {
        return JSON.parse(body);
      } catch {
        return null;
      }
    })();

    console.log(
      [
        result.valid ? "SIGNATURE OK  " : `SIGNATURE BAD (${result.reason})`,
        `event=${req.headers["x-webhook-event"]}`,
        `id=${eventId}`,
        duplicate ? "DUPLICATE" : "new",
        parsed?.data ? `ticket=${parsed.data.ticketNumber} sla=${parsed.data.slaHours}h` : "",
        parsed?.data?.dashboardUrl ? `url=${parsed.data.dashboardUrl}` : "",
      ].join("  ")
    );

    // Reject invalid signatures the way a real receiver should.
    res.writeHead(result.valid ? 200 : 401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ received: result.valid }));
  });
}).listen(port, () => console.log(`webhook receiver listening on http://localhost:${port}`));
