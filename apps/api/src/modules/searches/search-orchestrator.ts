import {
  SearchResponseSchema,
  type PublicRequirement,
  type SearchRequest,
  type SearchResponse,
} from "@midnight-hackathon/shared";
import type { CatalogProvider } from "../../integrations/alibaba/catalog-provider.js";
import { localReefKey, ReefAlibabaCatalog } from "../../integrations/alibaba/reef-catalog.js";
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

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "for", "to", "with"]);

function words(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function queryCandidates(requirement: PublicRequirement): string[] {
  const itemWords = words(requirement.item);
  const keywordWords = requirement.keywords.flatMap(words);
  const bigrams = itemWords.slice(0, -1).map((word, index) => `${word} ${itemWords[index + 1]}`);
  return unique([
    requirement.item,
    requirement.keywords.join(" "),
    ...itemWords,
    ...keywordWords,
    ...bigrams,
  ]).slice(0, 8);
}

export type PipelineEvent =
  | { type: "queries"; queries: string[] }
  | { type: "page"; query: string; offers: SearchResponse["offers"] }
  | { type: "done" }
  | { type: "error"; message: string };

function buildCandidates(requirement: PublicRequirement): SearchPlanCandidates {
  return {
    queries: unique([
      requirement.keywords.join(" "),
      requirement.item,
      `${requirement.item} ${requirement.keywords[0] ?? ""}`,
    ]),
    // destinationCountry is the buyer's destination, not the supplier's origin.
    countries: ["ALL"],
    // Reef's Alibaba search supports relevance, sales and response rate, not price or lead-time sort.
    sorts: ["relevance"],
  };
}

export class SearchOrchestrator {
  constructor(private readonly dependencies: SearchOrchestratorDependencies) {}

  private catalog(): CatalogProvider {
    const key = localReefKey();
    if (key) return new ReefAlibabaCatalog(key);
    return this.dependencies.catalog;
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const searchedAt = this.dependencies.now();
    const plan = await this.dependencies.jev.chooseSearchPlan(
      request.publicRequirement,
      buildCandidates(request.publicRequirement),
    );
    const listings = await this.catalog().search(plan, request.publicRequirement);
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

  async runPipeline(
    request: SearchRequest & { disclosedBudgetKrw?: string },
    emit: (event: PipelineEvent) => void,
  ): Promise<void> {
    const ordered = await this.dependencies.jev.orderQueries(
      request.publicRequirement,
      queryCandidates(request.publicRequirement),
      request.disclosedBudgetKrw,
    );
    emit({ type: "queries", queries: ordered });
    const seen = new Set<string>();
    for (const query of ordered) {
      const listings = await this.catalog().search(
        { query, country: "ALL", sort: "relevance" },
        request.publicRequirement,
      );
      const fresh = listings.filter((listing) => !seen.has(listing.listingId));
      for (const listing of fresh) seen.add(listing.listingId);
      const offers = await Promise.all(fresh.map((listing) => mapCatalogListingToOffer(
        listing,
        request.publicRequirement,
        { fetchedAt: this.dependencies.now(), krwPerCurrencyUnit: this.dependencies.krwPerCurrencyUnit },
      )));
      const ranked = offers.length === 0
        ? []
        : await this.dependencies.jev.rankOffers(request.publicRequirement, offers);
      emit({ type: "page", query, offers: ranked });
    }
    emit({ type: "done" });
  }
}
