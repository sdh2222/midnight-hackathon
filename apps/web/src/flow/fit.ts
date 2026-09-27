import type { Offer } from "@midnight-hackathon/shared";

export type Fit = "fits" | "over-cap" | "date" | "late";

// Same rule the previous compare screen used. This is not a ranker.
export function offerFit(
  offer: Pick<Offer, "convertedTotalKrw" | "deliveryDate">,
  capKrw: number,
  requiredBy: string,
): Fit {
  if (Number(offer.convertedTotalKrw) > capKrw) return "over-cap";
  if (requiredBy && !offer.deliveryDate) return "date";
  if (requiredBy && offer.deliveryDate && offer.deliveryDate > requiredBy) return "late";
  return "fits";
}
