import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Envelope encryption for third-party credentials held on behalf of a tenant
 * (currently Telegram bot tokens).
 *
 * Why these are encrypted while webhook signing secrets are not: the threat
 * models differ. A leaked bot token lets an attacker act as the customer's bot
 * towards the customer's own end users — damage that happens outside this
 * system, where we can neither detect nor stop it. A webhook secret is a
 * symmetric key shared with that same customer, has to be shown in the
 * dashboard so they can paste it into their automation, and is recomputed in
 * plaintext on every delivery; encrypting it buys only the narrow case of a
 * database leak without an environment leak, and adds a failure mode where
 * rotating the key breaks every endpoint at once.
 *
 * Format: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`. The version prefix means a
 * future algorithm change can be handled on read instead of requiring a
 * one-shot migration of every stored row.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const KEY_BYTES = 32;

export class SecretEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretEncryptionError";
  }
}

/**
 * Resolves the master key. Throws when unset or malformed — deliberately
 * fail-fast rather than falling back to plaintext, which would produce the
 * worst possible state: credentials stored in the clear while everything
 * reports that they are encrypted.
 */
function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new SecretEncryptionError(
      "INTEGRATION_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new SecretEncryptionError(
      `INTEGRATION_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`
    );
  }
  return key;
}

/** True when a usable key is configured — for surfacing setup problems in the UI. */
export function isSecretEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(envelope: string): string {
  const parts = envelope.split(":");
  if (parts.length !== 4) {
    throw new SecretEncryptionError("Malformed secret envelope");
  }

  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== VERSION) {
    throw new SecretEncryptionError(`Unsupported secret envelope version: ${version}`);
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // GCM authentication failed: wrong key, or the ciphertext was tampered with.
    // The distinction is not safe to expose.
    throw new SecretEncryptionError("Could not decrypt secret");
  }
}

/** Display form for a credential the user already provided — never the full value. */
export function maskSecret(plain: string, visible = 4): string {
  if (plain.length <= visible) return "••••";
  return `••••${plain.slice(-visible)}`;
}
