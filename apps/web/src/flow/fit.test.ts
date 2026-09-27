import { describe, expect, it } from "vitest";
import { offerFit } from "./fit";

describe("offerFit", () => {
  it("accepts a total inside the cap", () => {
    expect(offerFit({ convertedTotalKrw: "2600000", deliveryDate: "2026-10-01" }, 2_700_000, "")).toBe("fits");
  });

  it("rejects a total over the cap", () => {
    expect(offerFit({ convertedTotalKrw: "2800000" }, 2_700_000, "")).toBe("over-cap");
  });

  it("rejects a delivery after the needed-by date", () => {
    expect(offerFit({ convertedTotalKrw: "1000", deliveryDate: "2026-12-01" }, 2_700_000, "2026-10-01")).toBe("date");
  });

  it("rejects a missing delivery date when a needed-by date was set", () => {
    expect(offerFit({ convertedTotalKrw: "1000" }, 2_700_000, "2026-10-01")).toBe("date");
  });
});
