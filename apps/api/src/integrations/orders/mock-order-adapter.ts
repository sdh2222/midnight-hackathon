import type { ExecutionHistoryRecord } from "@midnight-hackathon/shared";
import type {
  OrderAdapter,
  OrderStatusResult,
  SubmitOrderResult,
} from "./order-adapter.js";

export class MockOrderAdapter implements OrderAdapter {
  readonly provider = "mock-alibaba";

  async submitOrder(
    execution: ExecutionHistoryRecord,
    options: { idempotencyKey: string },
  ): Promise<SubmitOrderResult> {
    return {
      providerOrderId: `mock-ali-${options.idempotencyKey}`,
      status: "order_submitted",
    };
  }

  async getOrderStatus(
    _providerOrderId: string,
    execution: ExecutionHistoryRecord,
  ): Promise<OrderStatusResult> {
    if (execution.status === "order_submitted") {
      return { status: "counterparty_accepted" };
    }
    if (execution.status === "counterparty_accepted") {
      return { status: "settled" };
    }
    return { status: execution.status === "cancelled" ? "cancelled" : "order_submitted" };
  }
}
