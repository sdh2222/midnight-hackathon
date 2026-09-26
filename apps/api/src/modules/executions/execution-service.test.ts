import type { ExecutionHistoryRecord } from "@midnight-hackathon/shared";
import { describe, expect, it, vi } from "vitest";
import {
  OrderAdapterError,
  type OrderAdapter,
} from "../../integrations/orders/order-adapter.js";
import { MockOrderAdapter } from "../../integrations/orders/mock-order-adapter.js";
import { ExecutionService } from "./execution-service.js";
import { InMemoryExecutionStore } from "./execution-store.js";

const timestamp = "2026-09-26T08:00:00.000Z";

function verifiedExecution(): ExecutionHistoryRecord {
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
    status: "verified",
    attemptCount: 0,
    events: [{ status: "verified", occurredAt: timestamp }],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("ExecutionService", () => {
  it("retries a transient submission error with the same idempotency key", async () => {
    const submitOrder = vi.fn<OrderAdapter["submitOrder"]>()
      .mockRejectedValueOnce(new OrderAdapterError("temporary", "TEMPORARY", true))
      .mockResolvedValue({ providerOrderId: "provider-order-1", status: "order_submitted" });
    const adapter: OrderAdapter = {
      provider: "flaky-provider",
      submitOrder,
      getOrderStatus: vi.fn(),
    };
    const wait = vi.fn(async () => undefined);
    const service = new ExecutionService({
      store: new InMemoryExecutionStore(),
      adapter,
      wait,
      now: () => timestamp,
      retryPolicy: { maxRetries: 2, baseDelayMs: 50 },
    });

    const result = await service.createAndExecute(verifiedExecution());

    expect(result.status).toBe("order_submitted");
    expect(result.attemptCount).toBe(2);
    expect(result.failureCode).toBeUndefined();
    expect(wait).toHaveBeenCalledWith(50);
    expect(submitOrder).toHaveBeenCalledTimes(2);
    expect(submitOrder.mock.calls.map(([, options]) => options.idempotencyKey))
      .toEqual([result.executionId, result.executionId]);
    expect(result.events.map(({ status }) => status)).toContain("retrying");
  });

  it("synchronizes an accepted order through settlement", async () => {
    const store = new InMemoryExecutionStore();
    const service = new ExecutionService({
      store,
      adapter: new MockOrderAdapter(),
      now: () => timestamp,
    });
    const submitted = await service.createAndExecute(verifiedExecution());
    const accepted = await service.sync(submitted.executionId, submitted.accountIdHash);
    const settled = await service.sync(submitted.executionId, submitted.accountIdHash);

    expect(accepted?.status).toBe("counterparty_accepted");
    expect(settled?.status).toBe("settled");
    expect(settled?.lastSyncedAt).toBe(timestamp);
  });

  it("keeps a non-retryable failure available for a later manual retry", async () => {
    let shouldFail = true;
    const adapter: OrderAdapter = {
      provider: "recoverable-provider",
      submitOrder: vi.fn(async () => {
        if (shouldFail) throw new OrderAdapterError("rejected", "ORDER_REJECTED", false);
        return { providerOrderId: "provider-order-2", status: "order_submitted" };
      }),
      getOrderStatus: vi.fn(),
    };
    const service = new ExecutionService({
      store: new InMemoryExecutionStore(),
      adapter,
      now: () => timestamp,
    });
    const failed = await service.createAndExecute(verifiedExecution());
    expect(failed).toMatchObject({ status: "failed", failureCode: "ORDER_REJECTED" });

    shouldFail = false;
    const retried = await service.retry(failed.executionId, failed.accountIdHash);
    expect(retried).toMatchObject({
      status: "order_submitted",
      providerOrderId: "provider-order-2",
      attemptCount: 2,
    });
  });
});
