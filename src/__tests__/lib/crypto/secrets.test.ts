import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isSecretEncryptionConfigured,
  SecretEncryptionError,
} from "@/lib/crypto/secrets";

const VALID_KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

describe("secrets", () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = original;
  });

  it("round-trips a value", () => {
    const token = "123456:ABC-DEF_ghIJklmNOPqrsTUVwxyz";
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it("round-trips non-ASCII content", () => {
    const value = "金鑰-🔐-Ünïcødé";
    expect(decryptSecret(encryptSecret(value))).toBe(value);
  });

  it("produces a different envelope each time (random IV)", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("emits the versioned four-part format", () => {
    const parts = encryptSecret("x").split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, ct] = encryptSecret("sensitive").split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 0xff;
    const tampered = [v, iv, tag, flipped.toString("base64")].join(":");

    expect(() => decryptSecret(tampered)).toThrow(SecretEncryptionError);
  });

  it("rejects an envelope encrypted under a different key", () => {
    const envelope = encryptSecret("sensitive");
    process.env.INTEGRATION_ENCRYPTION_KEY = OTHER_KEY;

    expect(() => decryptSecret(envelope)).toThrow(SecretEncryptionError);
  });

  it("rejects a malformed envelope", () => {
    expect(() => decryptSecret("not-an-envelope")).toThrow(SecretEncryptionError);
    expect(() => decryptSecret("v1:only:three")).toThrow(SecretEncryptionError);
  });

  it("rejects an unknown envelope version", () => {
    const envelope = encryptSecret("x").replace(/^v1:/, "v2:");
    expect(() => decryptSecret(envelope)).toThrow(/version/i);
  });

  it("fails fast when the key is missing rather than storing plaintext", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;

    expect(() => encryptSecret("x")).toThrow(SecretEncryptionError);
    expect(isSecretEncryptionConfigured()).toBe(false);
  });

  it("fails fast when the key is the wrong length", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.from("too short").toString("base64");

    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    expect(isSecretEncryptionConfigured()).toBe(false);
  });

  it("masks all but the last few characters", () => {
    expect(maskSecret("1234567890")).toBe("••••7890");
    expect(maskSecret("abc")).toBe("••••");
  });
});
