import { OfferSchema, type Offer } from "../schemas/offer.js";
import type { Bytes32Hex } from "../schemas/common.js";
import { canonicalJson } from "./canonical-json.js";
import { sha256Hex } from "./sha256.js";

export function canonicalOfferJson(input: unknown): string {
  return canonicalJson(OfferSchema.parse(input));
}

export async function offerSnapshotHash(input: Offer | unknown): Promise<Bytes32Hex> {
  return sha256Hex(canonicalOfferJson(input));
}
