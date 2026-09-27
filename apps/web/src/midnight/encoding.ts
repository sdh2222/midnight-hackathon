export {
  ZERO_BYTES_32,
  bytesToHex,
  dateToUnixDay,
  hashToBytes,
  hexToBytes,
} from "@midnight-hackathon/shared";

export function randomBytes32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
