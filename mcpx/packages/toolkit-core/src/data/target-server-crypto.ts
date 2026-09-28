import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const DELIMITER = ".";

// Generic AES-256-GCM encrypt/decrypt for any JSON-serializable value.
// Format: [base64-iv].[base64-authTag].[base64-ciphertext]
// key must be exactly 32 bytes.
export function encryptJson(data: unknown, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(DELIMITER);
}

export function decryptJson(encrypted: string, key: Buffer): unknown {
  const [ivB64, authTagB64, ciphertextB64, ...rest] =
    encrypted.split(DELIMITER);
  if (!ivB64 || !authTagB64 || !ciphertextB64 || rest.length > 0) {
    throw new Error("Invalid encrypted format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}

export const encryptInitiation = encryptJson;
export const decryptInitiation = decryptJson;
