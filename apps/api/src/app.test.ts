import { describe, expect, it } from "vitest";
import { SearchResponseSchema, offerSnapshotHash } from "@midnight-hackathon/shared";
import { buildApp } from "./app.js";

const fixedNow = "2026-09-24T12:00:00.000Z";
const fixedSearchId = "30b2072b-d82e-481c-b187-8c721fa1de65";

const validRequest = {
  intentId: "intent-gloves-001",
  publicRequirement: {
    item: "Industrial nitrile gloves",
    quantity: 10_000,
    unit: "piece",
    destinationCountry: "KR",
    keywords: ["nitrile gloves", "industrial"],
    requiredBy: "2026-10-15",
  },
};

describe("search API", () => {
  it("runs mock Jev -> Alibaba -> mapper -> Jev ranking", async () => {
    const app = buildApp({
      now: () => fixedNow,
      createId: () => fixedSearchId,
      environment: { JEV_PROVIDER: "mock" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(response.json());
    expect(body.searchId).toBe(fixedSearchId);
    expect(body.plan).toEqual({
      query: "nitrile gloves industrial",
      country: "ALL",
      sort: "relevance",
    });
    expect(body.offers).toHaveLength(4);
    expect(body.offers[0]?.offer.provider).toBe("alibaba");
    expect(body.offers[0]?.relevanceScore).toBeGreaterThanOrEqual(
      body.offers[1]?.relevanceScore ?? 0,
    );
    expect(body.offers.every(({ offer }) => /^[0-9a-f]{64}$/.test(offer.sourceId))).toBe(true);

    const snapshot = await offerSnapshotHash(body.offers[0]?.offer);
    expect(snapshot).toMatch(/^[0-9a-f]{64}$/);
    await app.close();
  });

  it("rejects a private budget hidden inside publicRequirement", async () => {
    const app = buildApp({ environment: { JEV_PROVIDER: "mock" } });
    const response = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: {
        ...validRequest,
        publicRequirement: {
          ...validRequest.publicRequirement,
          priceMaxKrw: "2000000",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "invalid_search_request" });
    await app.close();
  });

  it("is deterministic for the same listing snapshot", async () => {
    const options = {
      now: () => fixedNow,
      createId: () => fixedSearchId,
      environment: { JEV_PROVIDER: "mock" as const },
    };
    const firstApp = buildApp(options);
    const secondApp = buildApp(options);

    const [first, second] = await Promise.all([
      firstApp.inject({ method: "POST", url: "/v1/searches", payload: validRequest }),
      secondApp.inject({ method: "POST", url: "/v1/searches", payload: validRequest }),
    ]);

    expect(first.json()).toEqual(second.json());
    await Promise.all([firstApp.close(), secondApp.close()]);
  });

  it("uses real Jev HTTP decisions while keeping Alibaba mocked", async () => {
    const requests: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const responses = [
      {
        model: "jev-1.13.0",
        answers: {
          search_query: {
            type: "choice",
            choice: "query_1",
            probabilities: { query_0: 0.2, query_1: 0.7, query_2: 0.1 },
            confidence: 0.8,
          },
          search_country: {
            type: "choice",
            choice: "country_0",
            probabilities: { country_0: 0.9, country_1: 0.1 },
            confidence: 0.9,
          },
          search_sort: {
            type: "choice",
            choice: "sort_0",
            probabilities: { sort_0: 0.8, sort_1: 0.1, sort_2: 0.1 },
            confidence: 0.8,
          },
        },
      },
      {
        model: "jev-1.13.0",
        answers: Object.fromEntries(
          [3.1, 3.8, 2.4, 1.2].map((score, index) => [
            `offer_${index}`,
            {
              type: "score",
              score,
              confidence: 0.85,
              legend: {},
              probabilities: {},
            },
          ]),
        ),
      },
    ];
    const fakeFetch: typeof globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return Response.json(responses[requests.length - 1]);
    };
    const app = buildApp({
      now: () => fixedNow,
      createId: () => fixedSearchId,
      environment: {
        JEV_PROVIDER: "typesafe",
        JEV_API_KEY: "test-key",
      },
      fetch: fakeFetch,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(200);
    const body = SearchResponseSchema.parse(response.json());
    expect(body.plan.query).toBe("Industrial nitrile gloves");
    expect(body.offers).toHaveLength(4);
    expect(body.offers[0]?.relevanceScore).toBe(0.95);
    expect(requests).toHaveLength(2);
    expect(requests.every(({ url }) => url === "https://api.typesafe.ai/v1/systemone")).toBe(true);
    expect(requests.every(({ headers }) => headers.get("authorization") === "Bearer test-key")).toBe(true);
    expect(JSON.stringify(requests)).not.toContain("priceMaxKrw");
    await app.close();
  });

  it("returns a sanitized gateway error when Jev rejects the request", async () => {
    const app = buildApp({
      environment: {
        JEV_PROVIDER: "typesafe",
        JEV_API_KEY: "invalid-key",
        JEV_MAX_RETRIES: "0",
      },
      fetch: async () => Response.json({ detail: "invalid secret" }, { status: 401 }),
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: validRequest,
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: "jev_provider_error",
      message: "Jev could not evaluate the search request",
    });
    expect(response.body).not.toContain("invalid secret");
    await app.close();
  });
});
