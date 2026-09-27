import type {
  Offer,
  PublicRequirement,
  RankedOffer,
  SearchPlan,
} from "@midnight-hackathon/shared";
import type { JevProvider, SearchPlanCandidates } from "./jev-provider.js";

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value) * 1_000) / 1_000;
}

export class MockJevProvider implements JevProvider {
  async chooseSearchPlan(
    _requirement: PublicRequirement,
    candidates: SearchPlanCandidates,
  ): Promise<SearchPlan> {
    const query = candidates.queries.find((candidate) => candidate.trim().length > 0);
    const country = candidates.countries.includes("ALL") ? "ALL" : candidates.countries[0];
    const sort = candidates.sorts.includes("relevance") ? "relevance" : candidates.sorts[0];

    if (!query || !country || !sort) {
      throw new Error("search plan candidates must not be empty");
    }

    return { query, country, sort };
  }

  async orderQueries(requirement: PublicRequirement, queries: string[]): Promise<string[]> {
    const wanted = tokens(requirement.item);
    const overlap = (query: string) => [...tokens(query)].filter((token) => wanted.has(token)).length;
    return [...queries].sort((left, right) => overlap(right) - overlap(left) || left.localeCompare(right)).slice(0, 5);
  }

  async rankOffers(requirement: PublicRequirement, offers: Offer[]): Promise<RankedOffer[]> {
    const wanted = tokens(`${requirement.item} ${requirement.keywords.join(" ")}`);

    return offers
      .map((offer) => {
        const offered = tokens(`${offer.title} ${offer.variant ?? ""}`);
        const matched = [...wanted].filter((token) => offered.has(token)).length;
        const textScore = wanted.size === 0 ? 0 : matched / wanted.size;
        const quantityScore = offer.quantity === requirement.quantity ? 1 : 0.4;
        const unitScore = offer.unit.toLowerCase() === requirement.unit.toLowerCase() ? 1 : 0.2;

        let dateScore = 1;
        if (requirement.requiredBy) {
          dateScore = offer.deliveryDate && offer.deliveryDate <= requirement.requiredBy ? 1 : 0;
        }

        const relevanceScore = roundScore(
          textScore * 0.55 + quantityScore * 0.2 + unitScore * 0.15 + dateScore * 0.1,
        );
        const confidence = roundScore(0.65 + textScore * 0.25 + unitScore * 0.1);

        return {
          offer,
          relevanceScore,
          confidence,
          needsReview: relevanceScore < 0.65 || offer.quantity !== requirement.quantity
            || offer.pricingBasis === "catalog_estimate"
            || Boolean(requirement.requiredBy && !offer.deliveryDate),
        };
      })
      .sort((left, right) =>
        right.relevanceScore - left.relevanceScore ||
        right.confidence - left.confidence ||
        left.offer.offerId.localeCompare(right.offer.offerId),
      );
  }
}
