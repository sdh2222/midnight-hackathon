import type { ExecutionHistoryRecord } from "@midnight-hackathon/shared";
import {
  OrderAdapterError,
  type OrderAdapter,
} from "../../integrations/orders/order-adapter.js";
import type { ExecutionStore } from "./execution-store.js";
import {
  markExecutionSynced,
  transitionExecution,
} from "./execution-state-machine.js";

export type ExecutionRetryPolicy = {
  maxRetries: number;
  baseDelayMs: number;
};

export type ExecutionServiceOptions = {
  store: ExecutionStore;
  adapter: OrderAdapter;
  now?: () => string;
  retryPolicy?: Partial<ExecutionRetryPolicy>;
  wait?: (milliseconds: number) => Promise<void>;
};

const defaultWait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class ExecutionService {
  private readonly store: ExecutionStore;
  private readonly adapter: OrderAdapter;
  private readonly now: () => string;
  private readonly retryPolicy: ExecutionRetryPolicy;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(options: ExecutionServiceOptions) {
    this.store = options.store;
    this.adapter = options.adapter;
    this.now = options.now ?? (() => new Date().toISOString());
    this.retryPolicy = {
      maxRetries: options.retryPolicy?.maxRetries ?? 2,
      baseDelayMs: options.retryPolicy?.baseDelayMs ?? 100,
    };
    this.wait = options.wait ?? defaultWait;
  }

  async createAndExecute(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    const stored = await this.store.create(record);
    if (stored.status !== "verified") return stored;
    return this.execute(stored);
  }

  async retry(
    executionId: string,
    accountIdHash: string,
  ): Promise<ExecutionHistoryRecord | undefined> {
    const record = await this.store.get(executionId, accountIdHash);
    if (!record) return undefined;
    if (record.status !== "failed") {
      throw new Error(`execution cannot be retried from ${record.status}`);
    }
    return this.execute(record);
  }

  async sync(
    executionId: string,
    accountIdHash: string,
  ): Promise<ExecutionHistoryRecord | undefined> {
    const record = await this.store.get(executionId, accountIdHash);
    if (!record) return undefined;
    if (!["order_submitted", "counterparty_accepted"].includes(record.status)) return record;
    if (!record.providerOrderId) throw new Error("provider order ID is missing");

    try {
      const result = await this.adapter.getOrderStatus(record.providerOrderId, record);
      if (result.status === record.status) {
        return this.store.update(markExecutionSynced(record, this.now()));
      }
      return this.store.update(transitionExecution(
        record,
        result.status,
        this.now(),
        {
          note: `${this.adapter.provider} status synchronized`,
          ...(result.failureCode ? { failureCode: result.failureCode } : {}),
          lastSyncedAt: this.now(),
        },
      ));
    } catch (error) {
      if (error instanceof OrderAdapterError && error.retryable) {
        return this.store.update(markExecutionSynced(record, this.now()));
      }
      const failureCode = error instanceof OrderAdapterError
        ? error.code
        : "ORDER_STATUS_SYNC_FAILED";
      return this.store.update(transitionExecution(record, "failed", this.now(), {
        failureCode,
        note: "Order status synchronization failed",
      }));
    }
  }

  private async execute(initial: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    let current = initial;
    let retriesUsed = 0;

    while (true) {
      if (current.status === "failed") {
        current = await this.store.update(transitionExecution(
          current,
          "retrying",
          this.now(),
          { note: "Retry scheduled" },
        ));
      }

      current = await this.store.update(transitionExecution(
        current,
        "executing",
        this.now(),
        {
          incrementAttempt: true,
          note: `Submitting order through ${this.adapter.provider}`,
        },
      ));

      try {
        const submitted = await this.adapter.submitOrder(current, {
          idempotencyKey: current.executionId,
        });
        return this.store.update(transitionExecution(
          current,
          submitted.status,
          this.now(),
          {
            providerOrderId: submitted.providerOrderId,
            note: `${this.adapter.provider} accepted the order request`,
          },
        ));
      } catch (error) {
        const adapterError = error instanceof OrderAdapterError
          ? error
          : new OrderAdapterError("Order submission failed", "ORDER_SUBMISSION_FAILED", false);
        current = await this.store.update(transitionExecution(
          current,
          "failed",
          this.now(),
          {
            failureCode: adapterError.code,
            note: adapterError.message,
          },
        ));

        if (!adapterError.retryable || retriesUsed >= this.retryPolicy.maxRetries) {
          return current;
        }

        const delay = this.retryPolicy.baseDelayMs * (2 ** retriesUsed);
        retriesUsed += 1;
        await this.wait(delay);
      }
    }
  }
}
