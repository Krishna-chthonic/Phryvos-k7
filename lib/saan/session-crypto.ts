/**
 * Cryptographically Sound Session Vault
 * Clean-room TypeScript adaptation fixing RisuAI's static-zero-IV flaw.
 *
 * Implements:
 * 1. Authenticated AES-256-GCM encryption.
 * 2. Cryptographically unique 12-byte random nonces (IVs) generated via crypto.randomBytes(12).
 * 3. SHA-256 / PBKDF2 key derivation from user session secret passphrase.
 * 4. 16-byte authentication tag verification to prevent ciphertext forgery.
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "node:crypto";

export interface EncryptedSessionPayload {
  ciphertext: string; // base64
  iv: string;         // base64 (12 bytes)
  tag: string;        // base64 (16 bytes)
  salt: string;       // base64 (16 bytes)
  version: number;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit AES key from a passphrase and salt using PBKDF2.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypts a plaintext string into an authenticated AES-256-GCM payload.
 * Generates a fresh cryptographically random 12-byte IV for EVERY call.
 */
export function encryptSessionPayload(plaintext: string, secretKey: string): EncryptedSessionPayload {
  if (!secretKey || secretKey.length < 8) {
    throw new Error("Secret key must be at least 8 characters long for secure key derivation");
  }

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH); // Cryptographically unique IV
  const key = deriveKey(secretKey, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    salt: salt.toString("base64"),
    version: 1,
  };
}

/**
 * Decrypts an authenticated AES-256-GCM payload.
 * Throws an error if the tag does not verify or if the key is incorrect.
 */
export function decryptSessionPayload(payload: EncryptedSessionPayload, secretKey: string): string {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag || !payload.salt) {
    throw new Error("Invalid encrypted payload structure");
  }

  const salt = Buffer.from(payload.salt, "base64");
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");

  const key = deriveKey(secretKey, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
