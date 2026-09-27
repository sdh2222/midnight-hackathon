import type { PublicRequirement, SearchPlan } from "@midnight-hackathon/shared";

export type RawCatalogListing = {
  listingId: string;
  supplierId: string;
  supplierName?: string;
  supplierCountry: string;
  title: string;
  variant?: string;
  tags: string[];
  minimumOrderQuantity: number;
  unit: string;
  currency: string;
  unitPriceMinor: string;
  shippingMinor?: string;
  leadTimeDays?: number;
  pricingBasis?: "catalog_estimate";
  incoterm?: string;
  productUrl: string;
};

export interface CatalogProvider {
  search(plan: SearchPlan, requirement: PublicRequirement): Promise<RawCatalogListing[]>;
}
