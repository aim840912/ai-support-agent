import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/api-key";

describe("generateApiKey", () => {
  it("starts with sk_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk_/);
  });

  it("has sufficient length for 32 bytes base64url", () => {
    // 32 bytes → 43 base64url chars + "sk_" prefix = 46
    const key = generateApiKey();
    expect(key.length).toBeGreaterThanOrEqual(40);
  });

  it("generates unique keys each time", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });

  it("uses only URL-safe characters after prefix", () => {
    const key = generateApiKey();
    const payload = key.slice(3); // strip "sk_"
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashApiKey", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashApiKey("sk_test");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic — same input, same hash", () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it("different keys produce different hashes", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(hashApiKey(a)).not.toBe(hashApiKey(b));
  });

  it("hashing the raw key matches a stored hash at auth time", () => {
    const raw = generateApiKey();
    const storedHash = hashApiKey(raw);
    const incomingHash = hashApiKey(raw);
    expect(incomingHash).toBe(storedHash);
  });
});
