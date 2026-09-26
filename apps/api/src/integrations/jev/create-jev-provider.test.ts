import { describe, expect, it } from "vitest";
import { createJevProvider } from "./create-jev-provider.js";
import { HttpJevProvider } from "./http-jev.js";
import { MockJevProvider } from "./mock-jev.js";

describe("createJevProvider", () => {
  it("uses the mock provider by default", () => {
    expect(createJevProvider({})).toBeInstanceOf(MockJevProvider);
  });

  it("requires a server-side API key for the real provider", () => {
    expect(() => createJevProvider({ JEV_PROVIDER: "typesafe" })).toThrow(
      "JEV_API_KEY is required",
    );
  });

  it("creates the TypeSafe HTTP provider", () => {
    expect(
      createJevProvider({ JEV_PROVIDER: "typesafe", JEV_API_KEY: "secret" }),
    ).toBeInstanceOf(HttpJevProvider);
  });
});
