import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RankedOffer, SearchResponse } from "@midnight-hackathon/shared";
import { ListPage, OnboardPage, SortPage, VerifyPage } from "./screens";

const offer = {
  offerId: "offer-1",
  provider: "mock",
  providerListingId: "listing-1",
  sourceId: `0x${"ab".repeat(32)}`,
  supplierId: "supplier-1",
  supplierName: "North Mill",
  title: "Nitrile gloves",
  quantity: 10000,
  unit: "piece",
  originalCurrency: "KRW",
  originalUnitPrice: "260",
  convertedTotalKrw: "2600000",
  leadTimeDays: 12,
  deliveryDate: "2026-10-01",
  sourceUrl: "https://example.com/gloves",
  fetchedAt: "2026-09-27T00:00:00.000Z",
  rawPayloadHash: `0x${"cd".repeat(32)}`,
} as const;

const ranked: RankedOffer = {
  offer,
  relevanceScore: 0.9,
  confidence: 0.8,
  needsReview: false,
};

const result: SearchResponse = {
  searchId: "11111111-1111-4111-8111-111111111111",
  intentId: "intent-1",
  plan: { query: "nitrile gloves", country: "KR", sort: "relevance" },
  offers: [ranked],
  searchedAt: "2026-09-27T00:00:00.000Z",
};

describe("buy pages", () => {
  it("starts on onboard and continues into the buy", () => {
    const html = renderToStaticMarkup(
      <OnboardPage
        walletAddress={null}
        creatingWallet={false}
        jevKeyStored={false}
        reefKeyStored={false}
        error={null}
        onCreateWallet={() => undefined}
        onSaveJevKey={() => undefined}
        onSaveReefKey={() => undefined}
        onContinue={() => undefined}
      />,
    );
    expect(html).toContain("This repo");
    expect(html).toContain("We will");
    expect(html).toContain("Create wallet");
    expect(html).not.toContain("Seed");
  });

  it("shows the Jev order and asks to verify the fitting row", () => {
    const html = renderToStaticMarkup(
      <SortPage
        result={result}
        capKrw={2_700_000}
        requiredBy=""
        selectedId="offer-1"
        elapsedMs={1200}
        locked={null}
        onSelect={() => undefined}
        onEdit={() => undefined}
        onVerify={() => undefined}
      />,
    );
    expect(html).toContain("Jev");
    expect(html).toContain("Nitrile gloves");
    expect(html).toContain("Within cap");
    expect(html).toContain("Verify this row");
    expect(html).toContain("1.2s");
  });

  it("keeps the mapper on its own page, then opens the list", () => {
    const checking = renderToStaticMarkup(
      <VerifyPage
        ranked={ranked}
        capKrw={2_700_000}
        requiredBy=""
        rangeId={"a".repeat(64)}
        confirmed={false}
        running={false}
        error={null}
        verifiedId={null}
        onConfirm={() => undefined}
        onCheck={() => undefined}
        onOpenList={() => undefined}
      />,
    );
    expect(checking).toContain("Check the fit");
    expect(checking).toContain("Mapper");

    const done = renderToStaticMarkup(
      <ListPage
        result={result}
        capKrw={2_700_000}
        requiredBy=""
        keptId="offer-1"
        elapsedMs={1200}
        orderNote="The fit was checked."
        onNew={() => undefined}
        onHistory={() => undefined}
      />,
    );
    expect(done).toContain("Kept");
    expect(done).toContain("The fit was checked.");
  });
});
