import { describe, expect, it } from "vitest";
import { MockOrderAdapter } from "./mock-order-adapter.js";
import { createOrderAdapter } from "./create-order-adapter.js";

describe("createOrderAdapter", () => {
  it("uses the mock adapter by default", () => {
    expect(createOrderAdapter({})).toBeInstanceOf(MockOrderAdapter);
  });

  it("fails fast when an unimplemented provider is selected", () => {
    expect(() => createOrderAdapter({ ORDER_PROVIDER: "alibaba" }))
      .toThrow("Unsupported ORDER_PROVIDER: alibaba");
  });
});
