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

export interface JevProvider {
  chooseSearchPlan(
    requirement: PublicRequirement,
    candidates: SearchPlanCandidates,
  ): Promise<SearchPlan>;

  rankOffers(requirement: PublicRequirement, offers: Offer[]): Promise<RankedOffer[]>;
}
