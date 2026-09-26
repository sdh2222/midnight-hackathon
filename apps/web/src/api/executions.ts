import {
  CreateExecutionHistorySchema,
  ExecutionHistoryListSchema,
  ExecutionHistoryRecordSchema,
  type CreateExecutionHistory,
  type ExecutionHistoryRecord,
} from "@midnight-hackathon/shared";

function endpoint(path: string): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`;
}

async function apiError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { message?: unknown };
    if (typeof body.message === "string") return new Error(body.message);
  } catch {
    // Keep the safe fallback when the API returns a non-JSON response.
  }
  return new Error(fallback);
}

export async function createExecutionHistory(
  input: CreateExecutionHistory,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<ExecutionHistoryRecord> {
  const payload = CreateExecutionHistorySchema.parse(input);
  const response = await fetchImplementation(endpoint("/v1/executions"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await apiError(response, "거래 내역을 저장하지 못했습니다.");
  return ExecutionHistoryRecordSchema.parse(await response.json());
}

export async function listExecutionHistory(
  accountIdHash: string,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): Promise<ExecutionHistoryRecord[]> {
  const response = await fetchImplementation(
    endpoint(`/v1/executions?accountIdHash=${encodeURIComponent(accountIdHash)}`),
  );
  if (!response.ok) throw await apiError(response, "거래 내역을 불러오지 못했습니다.");
  return ExecutionHistoryListSchema.parse(await response.json());
}
