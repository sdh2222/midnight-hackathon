import type { PublicRequirement, SearchPlan } from "@midnight-hackathon/shared";
import type { CatalogProvider, RawCatalogListing } from "./catalog-provider.js";

const LISTINGS: RawCatalogListing[] = [
  {
    listingId: "ali-nitrile-1001",
    supplierId: "supplier-guangdong-01",
    supplierCountry: "CN",
    title: "Industrial powder-free nitrile gloves",
    variant: "Large / blue / 100 pcs box",
    tags: ["nitrile", "gloves", "industrial", "powder-free"],
    minimumOrderQuantity: 1_000,
    unit: "piece",
    currency: "USD",
    unitPriceMinor: "11",
    shippingMinor: "48000",
    leadTimeDays: 12,
    incoterm: "FOB",
    productUrl: "https://www.alibaba.com/product-detail/mock-nitrile-1001.html",
  },
  {
    listingId: "ali-nitrile-1002",
    supplierId: "supplier-jiangsu-07",
    supplierCountry: "CN",
    title: "Premium medical and industrial nitrile safety gloves",
    variant: "Large / black / 100 pcs box",
    tags: ["nitrile", "gloves", "industrial", "medical"],
    minimumOrderQuantity: 5_000,
    unit: "piece",
    currency: "USD",
    unitPriceMinor: "14",
    shippingMinor: "39000",
    leadTimeDays: 7,
    incoterm: "CIF",
    productUrl: "https://www.alibaba.com/product-detail/mock-nitrile-1002.html",
  },
  {
    listingId: "ali-nitrile-1003",
    supplierId: "supplier-vietnam-03",
    supplierCountry: "VN",
    title: "Disposable nitrile examination gloves bulk pack",
    variant: "Large / blue",
    tags: ["nitrile", "gloves", "disposable", "bulk"],
    minimumOrderQuantity: 20_000,
    unit: "piece",
    currency: "USD",
    unitPriceMinor: "9",
    shippingMinor: "62000",
    leadTimeDays: 18,
    incoterm: "FOB",
    productUrl: "https://www.alibaba.com/product-detail/mock-nitrile-1003.html",
  },
  {
    listingId: "ali-latex-2001",
    supplierId: "supplier-zhejiang-04",
    supplierCountry: "CN",
    title: "Reusable household latex cleaning gloves",
    variant: "Medium / yellow",
    tags: ["latex", "gloves", "household", "cleaning"],
    minimumOrderQuantity: 2_000,
    unit: "pair",
    currency: "USD",
    unitPriceMinor: "32",
    shippingMinor: "22000",
    leadTimeDays: 9,
    incoterm: "EXW",
    productUrl: "https://www.alibaba.com/product-detail/mock-latex-2001.html",
  },
];

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export class MockAlibabaCatalog implements CatalogProvider {
  async search(plan: SearchPlan, requirement: PublicRequirement): Promise<RawCatalogListing[]> {
    const queryTokens = new Set(tokens(plan.query));
    const requirementTokens = new Set([
      ...tokens(requirement.item),
      ...requirement.keywords.flatMap(tokens),
    ]);

    const matches = LISTINGS.filter((listing) => {
      if (plan.country !== "ALL" && listing.supplierCountry !== plan.country) {
        return false;
      }

      const listingTokens = new Set([
        ...tokens(listing.title),
        ...listing.tags.flatMap(tokens),
      ]);
      return [...queryTokens, ...requirementTokens].some((token) => listingTokens.has(token));
    });

    return matches.map((listing) => ({ ...listing, tags: [...listing.tags] }));
  }
}
