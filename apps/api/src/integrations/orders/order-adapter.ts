import type { ExecutionHistoryRecord, ExecutionStatus } from "@midnight-hackathon/shared";

export type SubmitOrderResult = {
  providerOrderId: string;
  status: Extract<ExecutionStatus, "order_submitted" | "counterparty_accepted">;
};

export type OrderStatusResult = {
  status: Extract<
    ExecutionStatus,
    "order_submitted" | "counterparty_accepted" | "settled" | "failed" | "cancelled"
  >;
  failureCode?: string;
};

export class OrderAdapterError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "OrderAdapterError";
  }
}

export interface OrderAdapter {
  readonly provider: string;
  submitOrder(
    execution: ExecutionHistoryRecord,
    options: { idempotencyKey: string },
  ): Promise<SubmitOrderResult>;
  getOrderStatus(
    providerOrderId: string,
    execution: ExecutionHistoryRecord,
  ): Promise<OrderStatusResult>;
}
