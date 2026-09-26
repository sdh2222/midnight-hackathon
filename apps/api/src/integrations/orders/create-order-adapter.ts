import type { OrderAdapter } from "./order-adapter.js";
import { MockOrderAdapter } from "./mock-order-adapter.js";

export type OrderEnvironment = {
  ORDER_PROVIDER?: string;
};

export function createOrderAdapter(environment: OrderEnvironment): OrderAdapter {
  const provider = environment.ORDER_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider === "mock") return new MockOrderAdapter();
  throw new Error(`Unsupported ORDER_PROVIDER: ${provider}`);
}
