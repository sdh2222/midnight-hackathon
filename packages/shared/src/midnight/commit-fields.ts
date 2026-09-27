import { sha256Hex } from "../hashing/sha256.js";

/** Unconstrained source id. A zero source stays inside the range commitment. */
export const ZERO_BYTES_32 = new Uint8Array(32);

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/iu.test(hex)) {
    throw new Error("Expected a 32-byte hexadecimal value");
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToBytes(value: string): Promise<Uint8Array> {
  return hexToBytes(await sha256Hex(value));
}

/** Midnight dates are unix days. An omitted date is unconstrained, which is day 0. */
export function dateToUnixDay(value: string | undefined): bigint {
  if (!value) return 0n;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid date value");
  }
  return BigInt(Math.floor(timestamp / 86_400_000));
}
