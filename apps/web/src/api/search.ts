import {
  RankedOfferSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  type PublicRequirement,
  type RankedOffer,
  type SearchRequest,
  type SearchResponse,
} from "@midnight-hackathon/shared";

export function buildSearchRequest(
  intentId: string,
  publicRequirement: PublicRequirement,
): SearchRequest {
  return SearchRequestSchema.parse({ intentId, publicRequirement });
}

export async function searchOffers(
  request: SearchRequest,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<SearchResponse> {
  const response = await fetchImplementation(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}/v1/searches`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    let message = "후보 검색에 실패했습니다.";
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // Upstream이 JSON을 반환하지 않으면 안전한 사용자용 메시지를 유지한다.
    }
    throw new Error(message);
  }

  return SearchResponseSchema.parse(await response.json());
}

export type PipelineEvent =
  | { type: "queries"; queries: string[] }
  | { type: "row"; query: string; offer: RankedOffer }
  | { type: "done" }
  | { type: "error"; message: string };

export async function streamPipeline(
  request: SearchRequest & { disclosedBudgetKrw?: string },
  onEvent: (event: PipelineEvent) => void,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<void> {
  const response = await fetchImplementation(
    `${import.meta.env.VITE_API_BASE_URL ?? ""}/v1/pipeline`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok || !response.body) {
    throw new Error("후보 검색에 실패했습니다.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as PipelineEvent;
      if (event.type === "row") {
        event.offer = RankedOfferSchema.parse(event.offer);
      }
      onEvent(event);
      if (event.type === "error") throw new Error(event.message);
    }
  }
}
