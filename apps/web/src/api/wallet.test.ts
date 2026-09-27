import { describe, expect, it, vi } from "vitest";
import { fetchServerWallet } from "./wallet";

describe("fetchServerWallet", () => {
  it("reads the linked Midnight address and ignores extra secrets", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      midnightAddress: "mn_addr_demo",
      created: true,
    }), { status: 200 }));

    await expect(fetchServerWallet(fetchImplementation)).resolves.toEqual({
      midnightAddress: "mn_addr_demo",
      created: true,
    });
    expect(fetchImplementation).toHaveBeenCalledWith("/v1/wallet");
  });

  it("rejects a payload that includes the seed", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      midnightAddress: "mn_addr_demo",
      created: false,
      seed: "11".repeat(32),
    }), { status: 200 }));

    await expect(fetchServerWallet(fetchImplementation)).rejects.toThrow();
  });
});
