import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ServerWalletSchema, sha256Hex } from "@midnight-hackathon/shared";
import { buildApp } from "../../app.js";
import { openSeed } from "./wallet-crypto.js";
import { JsonFileWalletStore } from "./wallet-store.js";
import { WalletService } from "./wallet-service.js";

const encryptionKey = "ab".repeat(32);
const alice = "did:privy:alice";

function addressesFor(seeds: string[]): (seedHex: string) => Promise<string> {
  return async (seedHex) => {
    const index = seeds.indexOf(seedHex);
    return `mn_addr_test_${index}_${seedHex.slice(0, 8)}`;
  };
}

describe("server wallet store", () => {
  it("creates one wallet per Privy user and keeps the seed encrypted", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wallets-"));
    const filePath = join(directory, "wallets.json");
    const seeds = ["11".repeat(32), "22".repeat(32)];
    let issued = 0;
    const service = WalletService.fromKey(
      new JsonFileWalletStore(filePath),
      encryptionKey,
      addressesFor(seeds),
      () => {
        const seed = seeds[issued];
        if (!seed) throw new Error("unexpected extra seed");
        issued += 1;
        return seed;
      },
    );

    const first = await service.ensure(alice);
    const second = await service.ensure(alice);
    expect(first).toEqual({ midnightAddress: "mn_addr_test_0_11111111", created: true });
    expect(second).toEqual({ midnightAddress: first.midnightAddress, created: false });
    expect(await service.readSeed(alice)).toBe(seeds[0]);

    const persisted = await readFile(filePath, "utf8");
    expect(persisted).not.toContain(seeds[0]);
    expect(persisted).not.toContain("seed");
    const [record] = JSON.parse(persisted) as Array<{
      ciphertext: string;
      iv: string;
      authTag: string;
      midnightAddress: string;
    }>;
    expect(record?.midnightAddress).toBe(first.midnightAddress);
    expect(openSeed(
      { ciphertext: record!.ciphertext, iv: record!.iv, authTag: record!.authTag },
      Buffer.from(encryptionKey, "hex"),
    )).toBe(seeds[0]);
  });

  it("returns the same wallet when two ensures overlap", async () => {
    const seeds = ["33".repeat(32)];
    const directory = await mkdtemp(join(tmpdir(), "wallets-"));
    const service = WalletService.fromKey(
      new JsonFileWalletStore(join(directory, "wallets.json")),
      encryptionKey,
      addressesFor(seeds),
      () => seeds[0]!,
    );
    const [left, right] = await Promise.all([service.ensure(alice), service.ensure(alice)]);
    expect(left).toEqual(right);
    expect(left.created).toBe(true);
    const persisted = JSON.parse(await readFile(
      join(directory, "wallets.json"),
      "utf8",
    )) as unknown[];
    expect(persisted).toHaveLength(1);
  });
});

describe("GET /v1/wallet", () => {
  it("requires the Privy session and never returns the seed", async () => {
    const seeds = ["44".repeat(32)];
    const app = buildApp({
      authVerifier: async (token) => {
        if (token !== "valid-token") throw new Error("invalid token");
        return alice;
      },
      walletEncryptionKey: encryptionKey,
      deriveMidnightAddress: addressesFor(seeds),
      createWalletSeed: () => seeds[0]!,
    });

    expect((await app.inject({ method: "GET", url: "/v1/wallet" })).statusCode).toBe(401);
    const created = await app.inject({
      method: "GET",
      url: "/v1/wallet",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(created.statusCode).toBe(200);
    expect(ServerWalletSchema.parse(created.json())).toEqual({
      midnightAddress: "mn_addr_test_0_44444444",
      created: true,
    });
    expect(created.body).not.toContain(seeds[0]);
    expect(created.body).not.toContain("ciphertext");

    const again = await app.inject({
      method: "GET",
      url: "/v1/wallet",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(again.json()).toMatchObject({ midnightAddress: "mn_addr_test_0_44444444", created: false });
    expect(await sha256Hex(`privy:${alice}`)).toMatch(/^[0-9a-f]{64}$/);
    await app.close();
  });
});
