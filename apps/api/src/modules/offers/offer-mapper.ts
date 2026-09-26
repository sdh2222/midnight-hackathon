import {
  OfferSchema,
  canonicalJson,
  sha256Hex,
  type Offer,
  type PublicRequirement,
} from "@midnight-hackathon/shared";
import type { RawCatalogListing } from "../../integrations/alibaba/catalog-provider.js";

export type OfferMapperOptions = {
  fetchedAt: string;
  krwPerCurrencyUnit: bigint;
};

const MINOR_UNITS = 100n;

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function formatMinorUnits(value: string): string {
  const minor = BigInt(value);
  const whole = minor / MINOR_UNITS;
  const fraction = (minor % MINOR_UNITS).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function addDays(isoTimestamp: string, days: number): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function mapCatalogListingToOffer(
  listing: RawCatalogListing,
  requirement: PublicRequirement,
  options: OfferMapperOptions,
): Promise<Offer> {
  const quantity = Math.max(requirement.quantity, listing.minimumOrderQuantity);
  const unitPriceMinor = BigInt(listing.unitPriceMinor);
  const shippingMinor = BigInt(listing.shippingMinor);
  const itemTotalMinor = unitPriceMinor * BigInt(quantity);
  const convertedItemTotalKrw = ceilDivide(
    itemTotalMinor * options.krwPerCurrencyUnit,
    MINOR_UNITS,
  );
  const shippingCostKrw = ceilDivide(
    shippingMinor * options.krwPerCurrencyUnit,
    MINOR_UNITS,
  );
  const rawPayloadHash = await sha256Hex(canonicalJson(listing));
  const sourceId = await sha256Hex(`alibaba:${listing.listingId}`);
  const offerId = await sha256Hex(
    canonicalJson({
      provider: "alibaba",
      listingId: listing.listingId,
      quantity,
      fetchedAt: options.fetchedAt,
      rawPayloadHash,
    }),
  );

  return OfferSchema.parse({
    offerId,
    provider: "alibaba",
    providerListingId: listing.listingId,
    sourceId,
    supplierId: listing.supplierId,
    title: listing.title,
    ...(listing.variant ? { variant: listing.variant } : {}),
    quantity,
    unit: listing.unit,
    minimumOrderQuantity: listing.minimumOrderQuantity,
    originalCurrency: listing.currency,
    originalUnitPrice: formatMinorUnits(listing.unitPriceMinor),
    convertedTotalKrw: (convertedItemTotalKrw + shippingCostKrw).toString(),
    shippingCostKrw: shippingCostKrw.toString(),
    exchangeRateTimestamp: options.fetchedAt,
    leadTimeDays: listing.leadTimeDays,
    deliveryDate: addDays(options.fetchedAt, listing.leadTimeDays),
    ...(listing.incoterm ? { incoterm: listing.incoterm } : {}),
    sourceUrl: listing.productUrl,
    fetchedAt: options.fetchedAt,
    rawPayloadHash,
  });
}
