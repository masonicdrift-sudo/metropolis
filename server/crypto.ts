/**
 * Server-side AES-256-GCM message encryption.
 * Key is loaded from ENCRYPTION_KEY env variable only.
 * This file never leaves the server — never imported by client code.
 *
 * Format stored in DB:
 *   iv:authTag:ciphertext   (all hex-encoded)
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const SENTINEL = "ENC:"; // prefix so we can detect encrypted vs plaintext rows

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: SENTINEL + iv:authTag:ciphertext
  return SENTINEL + [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(stored: string): string {
  // Handle legacy plaintext rows (before encryption was added)
  if (!stored.startsWith(SENTINEL)) return stored;
  const parts = stored.slice(SENTINEL.length).split(":");
  if (parts.length !== 3) return "[decryption error]";
  const [ivHex, tagHex, cipherHex] = parts;
  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "[decryption error]";
  }
}
