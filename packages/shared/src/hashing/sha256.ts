import { Bytes32HexSchema, type Bytes32Hex } from "../schemas/common.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<Bytes32Hex> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Bytes32HexSchema.parse(bytesToHex(new Uint8Array(digest)));
}
