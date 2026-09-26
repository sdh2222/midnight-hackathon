import { z } from "zod";
import { CountryCodeSchema } from "./common.js";
import { PublicRequirementSchema } from "./intent.js";
import { RankedOfferSchema } from "./offer.js";

export const SearchSortSchema = z.enum(["relevance", "price_asc", "lead_time_asc"]);
export const SearchCountrySchema = z.union([CountryCodeSchema, z.literal("ALL")]);

export const SearchPlanSchema = z
  .object({
    query: z.string().trim().min(1).max(300),
    country: SearchCountrySchema,
    sort: SearchSortSchema,
  })
  .strict();

export const SearchRequestSchema = z
  .object({
    intentId: z.string().trim().min(1).max(128),
    publicRequirement: PublicRequirementSchema,
  })
  .strict();

export const SearchResponseSchema = z
  .object({
    searchId: z.string().uuid(),
    intentId: z.string().trim().min(1).max(128),
    plan: SearchPlanSchema,
    offers: z.array(RankedOfferSchema),
    searchedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SearchSort = z.infer<typeof SearchSortSchema>;
export type SearchCountry = z.infer<typeof SearchCountrySchema>;
export type SearchPlan = z.infer<typeof SearchPlanSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
