import { describe, expect, it, vi } from "vitest";
import { buildSearchRequest, searchOffers } from "./search";

const publicRequirement = {
  item: "Industrial nitrile gloves",
  quantity: 10_000,
  unit: "piece",
  destinationCountry: "KR",
  keywords: ["nitrile gloves", "industrial"],
  requiredBy: "2026-10-20",
};

describe("search client", () => {
  it("builds a public-only request", () => {
    const request = buildSearchRequest("intent-1", publicRequirement);
    expect(request).toEqual({ intentId: "intent-1", publicRequirement });
    expect(JSON.stringify(request)).not.toContain("priceMaxKrw");
  });

  it("posts to the search API and validates the response", async () => {
    const responseBody = {
      searchId: "30b2072b-d82e-481c-b187-8c721fa1de65",
      intentId: "intent-1",
      plan: { query: "nitrile gloves", country: "ALL", sort: "relevance" },
      offers: [],
      searchedAt: "2026-09-25T00:00:00.000Z",
    };
    let capturedBody = "";
    const fakeFetch: typeof globalThis.fetch = vi.fn(async (_input, init) => {
      capturedBody = String(init?.body);
      return Response.json(responseBody);
    });
    const result = await searchOffers(
      buildSearchRequest("intent-1", publicRequirement),
      fakeFetch,
    );

    expect(result).toEqual(responseBody);
    expect(capturedBody).not.toContain("priceMaxKrw");
  });
});
