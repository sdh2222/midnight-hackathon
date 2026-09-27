import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landing } from "./landing";

describe("landing", () => {
  it("packs the buy, the cap, and the list onto the sign-in page", () => {
    const html = renderToStaticMarkup(<Landing login={() => undefined} />);
    expect(html).toContain("Sourcing still takes the day.");
    expect(html).toContain("Less time on the list.");
    expect(html).toContain("The private buy never reaches the agent.");
    expect(html).toContain("You leave with the order Jev made.");
    expect(html).toContain("Open Sourcenight");
    expect(html).toContain("commitRange");
    expect(html).toContain("commitVerify");
    expect(html).toContain("Sent to Jev");
    expect(html).toContain("Stays here");
    expect(html).toContain("Jev.Sort");
  });
});
