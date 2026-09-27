import { describe, expect, it } from "vitest";
import type { PublicRequirement, SearchPlan } from "@midnight-hackathon/shared";
import { ReefAlibabaCatalog, ReefCatalogError } from "./reef-catalog.js";

const plan: SearchPlan = { query: "nitrile gloves", country: "ALL", sort: "relevance" };
const requirement: PublicRequirement = {
  item: "Nitrile gloves",
  quantity: 1000,
  unit: "piece",
  destinationCountry: "KR",
  keywords: ["nitrile gloves"],
};

describe("ReefAPI Alibaba catalog", () => {
  it("searches with public fields and keeps catalog prices explicitly estimated", async () => {
    let captured: { url: string; headers: Headers; body: Record<string, unknown> } | undefined;
    const fakeFetch: typeof globalThis.fetch = async (input, init) => {
      captured = {
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      return Response.json({ ok: true, data: { results: [
        {
          product_id: "16000001", title: "Powder-free nitrile gloves",
          url: "https://www.alibaba.com/product-detail/gloves_16000001.html",
          price: { currency: "USD", min: 0.12, max: 0.195 },
          moq: { quantity: 100, unit: "pieces" },
          supplier: { company_id: "supplier-1", name: "Example", country: "CN" },
          certifications: ["CE"],
        },
        {
          product_id: "16000002", title: "Different unit",
          url: "https://www.alibaba.com/product-detail/boxes_16000002.html",
          price: { currency: "USD", min: 1, max: 2 },
          moq: { quantity: 100, unit: "boxes" },
          supplier: { company_id: "supplier-2", country: "CN" },
        },
      ] } });
    };
    const listings = await new ReefAlibabaCatalog("test-key", fakeFetch).search(plan, requirement);

    expect(captured?.url).toBe("https://api.reefapi.com/alibaba/v1/search");
    expect(captured?.headers.get("x-api-key")).toBe("test-key");
    expect(captured?.body).toEqual({ query: "nitrile gloves", page: 1, sort: "relevance", max_order: 1000 });
    expect(JSON.stringify(captured?.body)).not.toContain("priceMaxKrw");
    expect(listings).toEqual([expect.objectContaining({
      listingId: "16000001", supplierId: "supplier-1", supplierName: "Example", unit: "piece",
      unitPriceMinor: "20", pricingBasis: "catalog_estimate",
    })]);
    expect(listings[0]).not.toHaveProperty("shippingMinor");
    expect(listings[0]).not.toHaveProperty("leadTimeDays");
  });

  it("reports upstream failures without inventing offers", async () => {
    const catalog = new ReefAlibabaCatalog("test-key", async () => Response.json(
      { ok: false, error: { code: "TARGET_BLOCKED", message: "Search unavailable" } },
      { status: 502 },
    ));
    await expect(catalog.search(plan, requirement)).rejects.toMatchObject<Partial<ReefCatalogError>>({
      code: "TARGET_BLOCKED",
    });
  });
});
