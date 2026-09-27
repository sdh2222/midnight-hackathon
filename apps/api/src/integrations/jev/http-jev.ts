import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  SearchPlanSchema,
  type Offer,
  type PublicRequirement,
  type RankedOffer,
  type SearchCountry,
  type SearchPlan,
  type SearchSort,
} from "@midnight-hackathon/shared";
import { z } from "zod";
import { SEARCH_QUERY_PROMPT, type JevProvider, type SearchPlanCandidates } from "./jev-provider.js";

const ChoiceAnswerSchema = z
  .object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number().min(0).max(1)),
    confidence: z.number().min(0).max(1),
  })
  .passthrough();

const ScoreAnswerSchema = z
  .object({
    type: z.literal("score"),
    score: z.number().finite(),
    confidence: z.number().min(0).max(1),
  })
  .passthrough();

const JevResponseSchema = z
  .object({
    answers: z.record(z.string(), z.unknown()),
  })
  .passthrough();

type Fetch = typeof globalThis.fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export type HttpJevProviderOptions = {
  apiKey: string;
  endpoint?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  minimumConfidence?: number;
  fetch?: Fetch;
  sleep?: Sleep;
};

type JevQuestion = {
  type: "choice" | "score";
  instructions: string | Record<string, unknown>;
  criteria: Record<string, unknown> | unknown[];
};

type JevRequest = {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
};

const DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const localJevKeyFile = fileURLToPath(new URL("../../../../web/.local/jev-key", import.meta.url));

function localJevKey(): string | undefined {
  if (!existsSync(localJevKeyFile)) return undefined;
  const stored = readFileSync(localJevKeyFile, "utf8").trim();
  return stored.length > 0 ? stored : undefined;
}
const SCORE_LEVELS = [
  "Not suitable for the public requirement",
  "Weak match with major public requirement gaps",
  "Usable match with some public requirement gaps",
  "Strong match with only minor public requirement gaps",
  "Excellent match for the public requirement",
] as const;

export class JevProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "JevProviderError";
  }
}

function requireCandidates<T>(name: string, values: T[]): T[] {
  if (values.length === 0) {
    throw new JevProviderError(`${name} candidates must not be empty`);
  }
  return values;
}

function indexedCriteria<T>(prefix: string, values: T[]): Record<string, T> {
  return Object.fromEntries(values.map((value, index) => [`${prefix}_${index}`, value]));
}

function queriesByProbability(answerValue: unknown, queries: string[]): string[] {
  const parsed = ChoiceAnswerSchema.safeParse(answerValue);
  if (!parsed.success) {
    throw new JevProviderError("Jev returned an invalid choice answer", undefined, {
      cause: parsed.error,
    });
  }
  const ranked = Object.entries(parsed.data.probabilities)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .flatMap(([key]) => {
      const match = /^query_(\d+)$/u.exec(key);
      const index = match?.[1] === undefined ? Number.NaN : Number.parseInt(match[1], 10);
      const query = queries[index];
      return query === undefined ? [] : [query];
    });
  if (ranked.length > 0) return ranked.slice(0, 5);
  return [selectedCandidate(answerValue, queries, "query")];
}

function selectedCandidate<T>(
  answerValue: unknown,
  candidates: T[],
  prefix: string,
): T {
  const parsed = ChoiceAnswerSchema.safeParse(answerValue);
  if (!parsed.success) {
    throw new JevProviderError("Jev returned an invalid choice answer", undefined, {
      cause: parsed.error,
    });
  }
  const answer = parsed.data;
  const match = new RegExp(`^${prefix}_(\\d+)$`, "u").exec(answer.choice);
  const index = match?.[1] === undefined ? Number.NaN : Number.parseInt(match[1], 10);
  const selected = candidates[index];
  if (selected === undefined) {
    throw new JevProviderError(`Jev selected an unknown ${prefix} candidate`);
  }
  return selected;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, 10_000);
    }
  }
  return Math.min(500 * 2 ** attempt, 4_000);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export class HttpJevProvider implements JevProvider {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly minimumConfidence: number;
  private readonly fetchImplementation: Fetch;
  private readonly sleep: Sleep;

  constructor(private readonly options: HttpJevProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("JEV_API_KEY is required when JEV_PROVIDER=typesafe");
    }

    this.endpoint = new URL(options.endpoint ?? DEFAULT_ENDPOINT).toString();
    this.model = options.model ?? "jev-latest";
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.minimumConfidence = options.minimumConfidence ?? 0.65;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
  }

  async orderQueries(
    requirement: PublicRequirement,
    queries: string[],
    disclosedBudgetKrw?: string,
  ): Promise<string[]> {
    const pool = requireCandidates("query", queries).slice(0, 8);
    const result = await this.evaluate({
      model: this.model,
      state: {
        publicRequirement: requirement,
        ...(disclosedBudgetKrw ? { disclosedBudgetKrw } : {}),
        objective: SEARCH_QUERY_PROMPT,
      },
      questions: {
        search_queries: {
          type: "choice",
          instructions: SEARCH_QUERY_PROMPT,
          criteria: indexedCriteria("query", pool),
        },
      },
    });
    return queriesByProbability(result.answers.search_queries, pool);
  }

  async chooseSearchPlan(
    requirement: PublicRequirement,
    candidates: SearchPlanCandidates,
  ): Promise<SearchPlan> {
    const queries = requireCandidates("query", candidates.queries);
    const countries = requireCandidates("country", candidates.countries);
    const sorts = requireCandidates("sort", candidates.sorts);
    const result = await this.evaluate({
      model: this.model,
      state: {
        publicRequirement: requirement,
        objective: "Choose a catalog search plan using only the supplied candidates.",
      },
      questions: {
        search_query: {
          type: "choice",
          instructions: "Choose the query most likely to find matching B2B products.",
          criteria: indexedCriteria("query", queries),
        },
        search_country: {
          type: "choice",
          instructions: "Choose the supplier country filter. ALL means no country restriction.",
          criteria: indexedCriteria("country", countries),
        },
        search_sort: {
          type: "choice",
          instructions: "Choose the most useful catalog sort for this requirement.",
          criteria: indexedCriteria("sort", sorts),
        },
      },
    });

    return SearchPlanSchema.parse({
      query: selectedCandidate(result.answers.search_query, queries, "query"),
      country: selectedCandidate<SearchCountry>(
        result.answers.search_country,
        countries,
        "country",
      ),
      sort: selectedCandidate<SearchSort>(result.answers.search_sort, sorts, "sort"),
    });
  }

  async rankOffers(requirement: PublicRequirement, offers: Offer[]): Promise<RankedOffer[]> {
    if (offers.length === 0) {
      return [];
    }

    const publicOffers = offers.map((offer) => ({
      offerId: offer.offerId,
      title: offer.title,
      variant: offer.variant,
      quantity: offer.quantity,
      unit: offer.unit,
      minimumOrderQuantity: offer.minimumOrderQuantity,
      convertedTotalKrw: offer.convertedTotalKrw,
      pricingBasis: offer.pricingBasis,
      leadTimeDays: offer.leadTimeDays,
      deliveryDate: offer.deliveryDate,
      incoterm: offer.incoterm,
    }));
    const questions = Object.fromEntries(
      offers.map((offer, index) => [
        `offer_${index}`,
        {
          type: "score" as const,
          instructions: {
            question: "How well does the referenced offer satisfy the public requirement?",
            offerId: offer.offerId,
            rules: [
              "Use only the public requirement and offer fields in state.",
              "Consider item relevance, quantity, unit, required date, and keywords.",
              "Do not infer or evaluate any private buyer constraint.",
              "A catalog estimate excludes unknown shipping, and an absent delivery date is unverified.",
            ],
          },
          criteria: [...SCORE_LEVELS],
        },
      ]),
    );
    const result = await this.evaluate({
      model: this.model,
      state: {
        publicRequirement: requirement,
        offers: publicOffers,
      },
      questions,
    });

    return offers
      .map((offer, index) => {
        const parsed = ScoreAnswerSchema.safeParse(result.answers[`offer_${index}`]);
        if (!parsed.success) {
          throw new JevProviderError("Jev returned an invalid score answer", undefined, {
            cause: parsed.error,
          });
        }
        const answer = parsed.data;
        const relevanceScore = round(Math.max(0, Math.min(1, answer.score / (SCORE_LEVELS.length - 1))));
        const confidence = round(answer.confidence);
        return {
          offer,
          relevanceScore,
          confidence,
          needsReview: relevanceScore < 0.65 || confidence < this.minimumConfidence
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

  private async evaluate(request: JevRequest): Promise<z.infer<typeof JevResponseSchema>> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImplementation(this.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${localJevKey() ?? this.options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (attempt < this.maxRetries) {
          await this.sleep(Math.min(500 * 2 ** attempt, 4_000));
          continue;
        }
        throw new JevProviderError("Jev request failed", undefined, { cause: error });
      }

      if (response.ok) {
        try {
          return JevResponseSchema.parse(await response.json());
        } catch (error) {
          throw new JevProviderError("Jev returned an invalid response", response.status, {
            cause: error,
          });
        }
      }

      if ((response.status === 429 || response.status === 529) && attempt < this.maxRetries) {
        await this.sleep(retryDelay(response, attempt));
        continue;
      }

      throw new JevProviderError(`Jev returned HTTP ${response.status}`, response.status);
    }

    throw new JevProviderError("Jev request failed after retries");
  }
}
