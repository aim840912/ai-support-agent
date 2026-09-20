import { describe, it, expect } from "vitest";
import {
  generateWebhookSecret,
  signPayload,
  verifySignature,
  DEFAULT_TOLERANCE_SECONDS,
} from "@/lib/webhook-signature";

const SECRET = "whsec_test_secret_value";
const OTHER_SECRET = "whsec_a_different_secret";
const BODY = JSON.stringify({ event: "ticket.created", data: { ticketNumber: "TKT-1001" } });
const NOW = 1_758_000_000;

describe("generateWebhookSecret", () => {
  it("is prefixed so it can be told apart from the other credential families", () => {
    expect(generateWebhookSecret()).toMatch(/^whsec_[A-Za-z0-9_-]{20,}$/);
  });

  it("returns a different value each time", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe("signPayload / verifySignature", () => {
  it("signs deterministically for a fixed timestamp", () => {
    const a = signPayload(BODY, SECRET, NOW);
    const b = signPayload(BODY, SECRET, NOW);
    expect(a.header).toBe(b.header);
    expect(a.header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it("accepts a signature it produced", () => {
    const { header } = signPayload(BODY, SECRET, NOW);
    expect(verifySignature(BODY, header, SECRET, { nowSeconds: NOW })).toEqual({ valid: true });
  });

  it("rejects a body mutated by one character", () => {
    const { header } = signPayload(BODY, SECRET, NOW);
    const tampered = BODY.replace("TKT-1001", "TKT-1002");

    expect(verifySignature(tampered, header, SECRET, { nowSeconds: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a signature computed with a different secret", () => {
    const { header } = signPayload(BODY, OTHER_SECRET, NOW);

    expect(verifySignature(BODY, header, SECRET, { nowSeconds: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("binds the signature to the timestamp, so the pair cannot be replayed with a new one", () => {
    // Take a valid signature and present it under a fresh timestamp: without
    // the timestamp inside the signed material this would pass.
    const { header } = signPayload(BODY, SECRET, NOW);
    const digest = header.split("v1=")[1];
    const forged = `t=${NOW + 60},v1=${digest}`;

    expect(verifySignature(BODY, forged, SECRET, { nowSeconds: NOW + 60 })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("rejects a timestamp older than the tolerance window", () => {
    const { header } = signPayload(BODY, SECRET, NOW);

    expect(
      verifySignature(BODY, header, SECRET, {
        nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS + 1,
      })
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a timestamp too far in the future", () => {
    const { header } = signPayload(BODY, SECRET, NOW);

    expect(
      verifySignature(BODY, header, SECRET, {
        nowSeconds: NOW - DEFAULT_TOLERANCE_SECONDS - 1,
      })
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("accepts a timestamp at the edge of the window", () => {
    const { header } = signPayload(BODY, SECRET, NOW);

    expect(
      verifySignature(BODY, header, SECRET, { nowSeconds: NOW + DEFAULT_TOLERANCE_SECONDS })
    ).toEqual({ valid: true });
  });

  it("honours a custom tolerance", () => {
    const { header } = signPayload(BODY, SECRET, NOW);

    expect(
      verifySignature(BODY, header, SECRET, { nowSeconds: NOW + 30, toleranceSeconds: 10 })
    ).toEqual({ valid: false, reason: "expired" });
  });

  it.each([
    ["empty string", ""],
    ["missing v1", `t=${NOW}`],
    ["missing t", "v1=abc123"],
    ["no separators", "garbage"],
    ["non-numeric timestamp", `t=not-a-number,v1=abc123`],
  ])("rejects a malformed header (%s)", (_label, header) => {
    expect(verifySignature(BODY, header, SECRET, { nowSeconds: NOW })).toEqual({
      valid: false,
      reason: "malformed",
    });
  });

  it("does not throw when the presented digest has the wrong length", () => {
    // timingSafeEqual throws on mismatched buffer lengths, so the comparison
    // has to check length first.
    const forged = `t=${NOW},v1=aa`;

    expect(() => verifySignature(BODY, forged, SECRET, { nowSeconds: NOW })).not.toThrow();
    expect(verifySignature(BODY, forged, SECRET, { nowSeconds: NOW })).toEqual({
      valid: false,
      reason: "mismatch",
    });
  });

  it("does not throw when the presented digest is not hex", () => {
    const forged = `t=${NOW},v1=${"z".repeat(64)}`;

    expect(() => verifySignature(BODY, forged, SECRET, { nowSeconds: NOW })).not.toThrow();
  });

  it("tolerates whitespace around the header parts", () => {
    const { header } = signPayload(BODY, SECRET, NOW);
    const spaced = header.split(",").join(", ");

    expect(verifySignature(BODY, spaced, SECRET, { nowSeconds: NOW })).toEqual({ valid: true });
  });

  it("round-trips an empty body", () => {
    const { header } = signPayload("", SECRET, NOW);
    expect(verifySignature("", header, SECRET, { nowSeconds: NOW })).toEqual({ valid: true });
  });
});
