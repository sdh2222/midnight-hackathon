import { describe, expect, it } from "vitest";
import { OfferSchema, type PublicRequirement } from "@midnight-hackathon/shared";
import { DemoIntentContractAdapter } from "./demo-adapter";
import { InMemoryPrivateIntentVault } from "./private-vault";
import { ProcurementContractWorkflow } from "./workflow";

const requirement: PublicRequirement = {
  item: "Industrial nitrile gloves",
  quantity: 10_000,
  unit: "piece",
  destinationCountry: "KR",
  keywords: ["nitrile gloves", "industrial"],
  requiredBy: "2026-10-20",
};

const offer = OfferSchema.parse({
  offerId: "offer-1",
  provider: "alibaba",
  providerListingId: "listing-1",
  sourceId: "ab".repeat(32),
  supplierId: "supplier-1",
  title: "Industrial nitrile gloves",
  quantity: 10_000,
  unit: "piece",
  originalCurrency: "USD",
  originalUnitPrice: "0.14",
  convertedTotalKrw: "2416500",
  leadTimeDays: 7,
  deliveryDate: "2026-10-02",
  sourceUrl: "https://example.com/offer-1",
  fetchedAt: "2026-09-25T00:00:00.000Z",
  rawPayloadHash: "cd".repeat(32),
});

function workflow(): ProcurementContractWorkflow {
  return new ProcurementContractWorkflow(
    new DemoIntentContractAdapter(),
    new InMemoryPrivateIntentVault(),
    () => new Uint8Array(32).fill(7),
  );
}

describe("ProcurementContractWorkflow", () => {
  it("requires wallet connection before commitRange", async () => {
    await expect(
      workflow().lockIntent({
        intentId: "intent-1",
        publicRequirement: requirement,
        priceMaxKrw: 2_700_000n,
      }),
    ).rejects.toThrow("Connect the wallet first");
  });

  it("locks the private range before verifying an eligible offer", async () => {
    const subject = workflow();
    await subject.connectWallet();
    const locked = await subject.lockIntent({
      intentId: "intent-1",
      publicRequirement: requirement,
      priceMaxKrw: 2_700_000n,
    });
    const verified = await subject.verifyOffer("intent-1", offer);

    expect(locked.commitRangeTransactionId).toMatch(/^[0-9a-f]{64}$/);
    expect(locked.priceMax).toBe(2_700_000n);
    expect(verified.commitVerifyTransactionId).toMatch(/^[0-9a-f]{64}$/);
    expect(verified.offer.offerId).toBe("offer-1");
  });

  it("rejects an offer above the committed private budget", async () => {
    const subject = workflow();
    await subject.connectWallet();
    await subject.lockIntent({
      intentId: "intent-1",
      publicRequirement: requirement,
      priceMaxKrw: 2_000_000n,
    });

    await expect(subject.verifyOffer("intent-1", offer)).rejects.toThrow(
      "잠긴 최대 예산을 초과",
    );
  });

  it("does not allow commitVerify before commitRange", async () => {
    const subject = workflow();
    await subject.connectWallet();
    await expect(subject.verifyOffer("missing-intent", offer)).rejects.toThrow(
      "private intent를 찾지 못했습니다",
    );
  });
});
