import type { ExecutionHistoryRecord } from "@midnight-hackathon/shared";
import { describe, expect, it } from "vitest";
import { canTransition, transitionExecution } from "./execution-state-machine.js";

const timestamp = "2026-09-26T08:00:00.000Z";

function execution(status: ExecutionHistoryRecord["status"]): ExecutionHistoryRecord {
  return {
    approvalId: "5980675d-1412-4bbb-b5f4-57bcbb59245d",
    accountIdHash: "d".repeat(64),
    intentId: "intent-001",
    publicRequirement: {
      item: "Industrial nitrile gloves",
      quantity: 10_000,
      unit: "piece",
      destinationCountry: "KR",
      keywords: ["nitrile gloves"],
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
      fetchedAt: timestamp,
      rawPayloadHash: "b".repeat(64),
    },
    offerSnapshotHash: "c".repeat(64),
    commitRangeTransactionId: "range-tx",
    commitVerifyTransactionId: "verify-tx",
    approvedAt: timestamp,
    executionId: "c19f58ce-fb62-433d-b4f2-7b84c9ef9326",
    status,
    attemptCount: 0,
    events: [{ status, occurredAt: timestamp }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("execution state machine", () => {
  it("permits the verified order lifecycle", () => {
    expect(canTransition("verified", "executing")).toBe(true);
    expect(canTransition("executing", "order_submitted")).toBe(true);
    expect(canTransition("order_submitted", "counterparty_accepted")).toBe(true);
    expect(canTransition("counterparty_accepted", "settled")).toBe(true);
  });

  it("rejects transitions out of a terminal state", () => {
    expect(() => transitionExecution(execution("settled"), "executing", timestamp))
      .toThrow("invalid execution transition: settled -> executing");
  });

  it("records attempts and clears a previous failure after retry", () => {
    const failed = { ...execution("failed"), failureCode: "TEMPORARY" };
    const retrying = transitionExecution(failed, "retrying", timestamp);
    const executing = transitionExecution(retrying, "executing", timestamp, {
      incrementAttempt: true,
    });

    expect(executing.attemptCount).toBe(1);
    expect(executing.failureCode).toBeUndefined();
    expect(executing.events.map(({ status }) => status)).toEqual([
      "failed",
      "retrying",
      "executing",
    ]);
  });
});
