import type { CreateExecutionHistory, ExecutionHistoryRecord } from "@midnight-hackathon/shared";
import { describe, expect, it, vi } from "vitest";
import {
  createExecutionHistory,
  listExecutionHistory,
  retryExecutionHistory,
  syncExecutionHistory,
} from "./executions";

const input: CreateExecutionHistory = {
  approvalId: "5980675d-1412-4bbb-b5f4-57bcbb59245d",
  accountIdHash: "d".repeat(64),
  intentId: "intent-history-001",
  publicRequirement: {
    item: "Industrial nitrile gloves",
    quantity: 10_000,
    unit: "piece",
    destinationCountry: "KR",
    keywords: ["nitrile gloves"],
    requiredBy: "2026-10-15",
  },
  offer: {
    offerId: "offer-1",
    provider: "mock",
    providerListingId: "listing-1",
    sourceId: "a".repeat(64),
    supplierId: "supplier-1",
    title: "Industrial nitrile gloves",
    quantity: 10_000,
    unit: "piece",
    originalCurrency: "USD",
    originalUnitPrice: "0.1",
    convertedTotalKrw: "1350000",
    sourceUrl: "https://example.com/listing-1",
    fetchedAt: "2026-09-26T08:00:00.000Z",
    rawPayloadHash: "b".repeat(64),
  },
  offerSnapshotHash: "c".repeat(64),
  commitRangeTransactionId: "range-tx",
  commitVerifyTransactionId: "verify-tx",
  approvedAt: "2026-09-26T08:00:00.000Z",
};

const record: ExecutionHistoryRecord = {
  ...input,
  executionId: "c19f58ce-fb62-433d-b4f2-7b84c9ef9326",
  status: "verified",
  attemptCount: 0,
  events: [{ status: "verified", occurredAt: input.approvedAt }],
  createdAt: input.approvedAt,
  updatedAt: input.approvedAt,
};

describe("execution history API client", () => {
  it("creates a history record without private criteria", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual(input);
      expect(String(init?.body)).not.toContain("priceMaxKrw");
      return Response.json(record, { status: 201 });
    });

    await expect(createExecutionHistory(input, fetchMock)).resolves.toEqual(record);
  });

  it("loads persisted records", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toContain(`accountIdHash=${input.accountIdHash}`);
      return Response.json([record]);
    });
    await expect(listExecutionHistory(input.accountIdHash, fetchMock)).resolves.toEqual([record]);
  });

  it.each([
    ["sync", syncExecutionHistory],
    ["retry", retryExecutionHistory],
  ] as const)("posts the %s action for an execution", async (action, request) => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toContain(`/v1/executions/${record.executionId}/${action}`);
      expect(String(url)).toContain(`accountIdHash=${input.accountIdHash}`);
      expect(init?.method).toBe("POST");
      return Response.json(record);
    });

    await expect(request(record.executionId, input.accountIdHash, fetchMock))
      .resolves.toEqual(record);
  });
});
