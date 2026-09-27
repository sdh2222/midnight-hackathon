import type {
  Offer,
  PublicRequirement,
  RankedOffer,
  SearchCountry,
  SearchPlan,
  SearchSort,
} from "@midnight-hackathon/shared";

export type SearchPlanCandidates = {
  queries: string[];
  countries: SearchCountry[];
  sorts: SearchSort[];
};

export const SEARCH_QUERY_PROMPT =
  "Using only the public buy, in the priority order given, choose the catalog search query for this item. Do not use a private field.";

export interface JevProvider {
  chooseSearchPlan(
    requirement: PublicRequirement,
    candidates: SearchPlanCandidates,
  ): Promise<SearchPlan>;

  orderQueries(
    requirement: PublicRequirement,
    queries: string[],
    disclosedBudgetKrw?: string,
  ): Promise<string[]>;

  rankOffers(requirement: PublicRequirement, offers: Offer[]): Promise<RankedOffer[]>;
}
