import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SealedSeed = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function parseEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("WALLET_ENCRYPTION_KEY must be 64 hex characters");
  }
  return Buffer.from(trimmed, "hex");
}

export function sealSeed(seedHex: string, key: Buffer): SealedSeed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(seedHex, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function openSeed(sealed: SealedSeed, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
