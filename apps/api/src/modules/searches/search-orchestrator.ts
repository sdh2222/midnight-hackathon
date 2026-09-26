import {
  SearchResponseSchema,
  type PublicRequirement,
  type SearchRequest,
  type SearchResponse,
} from "@midnight-hackathon/shared";
import type { CatalogProvider } from "../../integrations/alibaba/catalog-provider.js";
import type { JevProvider, SearchPlanCandidates } from "../../integrations/jev/jev-provider.js";
import { mapCatalogListingToOffer } from "../offers/offer-mapper.js";

export type SearchOrchestratorDependencies = {
  catalog: CatalogProvider;
  jev: JevProvider;
  now: () => string;
  createId: () => string;
  krwPerCurrencyUnit: bigint;
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildCandidates(requirement: PublicRequirement): SearchPlanCandidates {
  return {
    queries: unique([
      requirement.keywords.join(" "),
      requirement.item,
      `${requirement.item} ${requirement.keywords[0] ?? ""}`,
    ]),
    countries: ["ALL", requirement.destinationCountry],
    sorts: ["relevance", "price_asc", "lead_time_asc"],
  };
}

export class SearchOrchestrator {
  constructor(private readonly dependencies: SearchOrchestratorDependencies) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const searchedAt = this.dependencies.now();
    const plan = await this.dependencies.jev.chooseSearchPlan(
      request.publicRequirement,
      buildCandidates(request.publicRequirement),
    );
    const listings = await this.dependencies.catalog.search(plan, request.publicRequirement);
    const offers = await Promise.all(
      listings.map((listing) =>
        mapCatalogListingToOffer(listing, request.publicRequirement, {
          fetchedAt: searchedAt,
          krwPerCurrencyUnit: this.dependencies.krwPerCurrencyUnit,
        }),
      ),
    );
    const rankedOffers = await this.dependencies.jev.rankOffers(
      request.publicRequirement,
      offers,
    );

    return SearchResponseSchema.parse({
      searchId: this.dependencies.createId(),
      intentId: request.intentId,
      plan,
      offers: rankedOffers,
      searchedAt,
    });
  }
}
