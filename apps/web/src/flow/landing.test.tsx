import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Landing } from "./landing";

describe("landing", () => {
  it("packs the buy, the cap, and the list onto the sign-in page", () => {
    const html = renderToStaticMarkup(<Landing login={() => undefined} />);
    expect(html).toContain("Open Sourcenight");
    expect(html).toContain("commitRange");
    expect(html).toContain("commitVerify");
    expect(html).toContain("Sent to Jev");
    expect(html).toContain("Stays here");
    expect(html).toContain("Unit price");
    expect(html).toContain("Jev.Sort");
  });
});
