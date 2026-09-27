import { describe, expect, it } from "vitest";
import {
  ApprovalReceiptSchema,
  IntentSplitSchema,
  OfferSchema,
  PublicRequirementSchema,
  ZERO_BYTES_32,
  canonicalOfferJson,
  dateToUnixDay,
  hashToBytes,
  offerSnapshotHash,
} from "./index.js";

const hex = (character: string): string => character.repeat(64);

const offer = {
  offerId: "offer-001",
  provider: "alibaba" as const,
  providerListingId: "listing-42",
  sourceId: hex("a"),
  supplierId: "supplier-7",
  title: "Industrial nitrile gloves",
  variant: "Large / blue",
  quantity: 10_000,
  unit: "piece",
  minimumOrderQuantity: 1_000,
  originalCurrency: "USD",
  originalUnitPrice: "0.12",
  convertedTotalKrw: "1620000",
  shippingCostKrw: "120000",
  exchangeRateTimestamp: "2026-09-24T12:00:00Z",
  leadTimeDays: 14,
  deliveryDate: "2026-10-15",
  incoterm: "FOB",
  sourceUrl: "https://www.alibaba.com/product-detail/example.html",
  fetchedAt: "2026-09-24T12:00:00Z",
  expiresAt: "2026-09-25T12:00:00Z",
  rawPayloadHash: hex("b"),
};

describe("privacy boundary schemas", () => {
  it("accepts a valid public/private intent split", () => {
    const parsed = IntentSplitSchema.parse({
      publicRequirement: {
        item: "Industrial nitrile gloves",
        quantity: 10_000,
        unit: "piece",
        destinationCountry: "KR",
        keywords: ["nitrile gloves", "industrial"],
        requiredBy: "2026-10-15",
      },
      privateCriteria: {
        priceMaxKrw: 2_000_000n,
        dateMax: 20_400,
        salt: new Uint8Array(32),
      },
    });

    expect(parsed.privateCriteria.priceMaxKrw).toBe(2_000_000n);
  });

  it("rejects private fields in a public requirement", () => {
    expect(() =>
      PublicRequirementSchema.parse({
        item: "Industrial nitrile gloves",
        quantity: 10_000,
        unit: "piece",
        destinationCountry: "KR",
        keywords: ["nitrile gloves"],
        priceMaxKrw: "2000000",
      }),
    ).toThrow();
  });
});

describe("offer snapshot", () => {
  it("validates the normalized offer", () => {
    expect(OfferSchema.parse(offer)).toEqual(offer);
  });

  it("is stable regardless of object key insertion order", async () => {
    const reversed = Object.fromEntries(Object.entries(offer).reverse());

    expect(canonicalOfferJson(reversed)).toBe(canonicalOfferJson(offer));
    expect(await offerSnapshotHash(reversed)).toBe(await offerSnapshotHash(offer));
  });

  it("changes when an approved term changes", async () => {
    const changed = { ...offer, convertedTotalKrw: "1620001" };
    expect(await offerSnapshotHash(changed)).not.toBe(await offerSnapshotHash(offer));
  });
});

describe("commit field mapping", () => {
  it("hashes text to 32 bytes and treats a missing date as unconstrained", async () => {
    expect(ZERO_BYTES_32).toEqual(new Uint8Array(32));
    expect(await hashToBytes("industrial nitrile gloves")).toHaveLength(32);
    expect(dateToUnixDay(undefined)).toBe(0n);
    expect(dateToUnixDay("2026-10-15")).toBe(20_741n);
  });

  it("rejects a date that is not a calendar day", () => {
    expect(() => dateToUnixDay("not-a-date")).toThrow("Invalid date value");
  });
});

describe("approval receipt", () => {
  it("contains no private criteria", () => {
    const receipt = ApprovalReceiptSchema.parse({
      approvalId: "ddf7351d-6424-491e-aae1-73e46b82d15e",
      intentId: "intent-001",
      intentIdHash: hex("c"),
      offerSnapshotHash: hex("d"),
      sourceId: offer.sourceId,
      approvedAt: "2026-09-24T12:30:00Z",
      walletAddress: "mn_addr_test1example",
      termsVersion: "1",
      walletSignature: "signature",
    });

    expect("priceMaxKrw" in receipt).toBe(false);
    expect("salt" in receipt).toBe(false);
  });

  it("rejects accidental private criteria in the backend receipt", () => {
    expect(() =>
      ApprovalReceiptSchema.parse({
        approvalId: "ddf7351d-6424-491e-aae1-73e46b82d15e",
        intentId: "intent-001",
        intentIdHash: hex("c"),
        offerSnapshotHash: hex("d"),
        sourceId: offer.sourceId,
        approvedAt: "2026-09-24T12:30:00Z",
        walletAddress: "mn_addr_test1example",
        termsVersion: "1",
        walletSignature: "signature",
        priceMaxKrw: "2000000",
      }),
    ).toThrow();
  });
});
