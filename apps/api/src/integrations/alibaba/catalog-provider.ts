import type { PublicRequirement, SearchPlan } from "@midnight-hackathon/shared";

export type RawCatalogListing = {
  listingId: string;
  supplierId: string;
  supplierCountry: string;
  title: string;
  variant?: string;
  tags: string[];
  minimumOrderQuantity: number;
  unit: string;
  currency: string;
  unitPriceMinor: string;
  shippingMinor: string;
  leadTimeDays: number;
  incoterm?: string;
  productUrl: string;
};

export interface CatalogProvider {
  search(plan: SearchPlan, requirement: PublicRequirement): Promise<RawCatalogListing[]>;
}
