import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExecutionHistoryListSchema,
  ExecutionHistoryRecordSchema,
  SearchResponseSchema,
  offerSnapshotHash,
} from "@midnight-hackathon/shared";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { JsonFileExecutionStore } from "./modules/executions/execution-store.js";

const fixedNow = "2026-09-26T08:00:00.000Z";
const searchId = "30b2072b-d82e-481c-b187-8c721fa1de65";
const executionId = "c19f58ce-fb62-433d-b4f2-7b84c9ef9326";
const approvalId = "5980675d-1412-4bbb-b5f4-57bcbb59245d";
const accountIdHash = "d".repeat(64);

const publicRequirement = {
  item: "Industrial nitrile gloves",
  quantity: 10_000,
  unit: "piece",
  destinationCountry: "KR",
  keywords: ["nitrile gloves", "industrial"],
  requiredBy: "2026-10-15",
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, { recursive: true, force: true }),
  ));
});

describe("execution history API", () => {
  it("persists a verified approval without private budget data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "midnight-executions-"));
    temporaryDirectories.push(directory);
    const storePath = join(directory, "executions.json");
    const ids = [searchId, executionId];
    const app = buildApp({
      now: () => fixedNow,
      createId: () => ids.shift() ?? crypto.randomUUID(),
      environment: { JEV_PROVIDER: "mock" },
      executionStore: new JsonFileExecutionStore(storePath),
    });

    const searchResponse = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: { intentId: "intent-history-001", publicRequirement },
    });
    const search = SearchResponseSchema.parse(searchResponse.json());
    const offer = search.offers[0]!.offer;
    const snapshotHash = await offerSnapshotHash(offer);
    const createPayload = {
      approvalId,
      accountIdHash,
      intentId: search.intentId,
      publicRequirement,
      offer,
      offerSnapshotHash: snapshotHash,
      commitRangeTransactionId: "range-tx-001",
      commitVerifyTransactionId: "verify-tx-001",
      approvedAt: fixedNow,
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: createPayload,
    });
    expect(createResponse.statusCode).toBe(201);
    const created = ExecutionHistoryRecordSchema.parse(createResponse.json());
    expect(created).toMatchObject({
      executionId,
      approvalId,
      status: "verified",
      commitRangeTransactionId: "range-tx-001",
      commitVerifyTransactionId: "verify-tx-001",
    });
    await app.close();

    const restarted = buildApp({
      environment: { JEV_PROVIDER: "mock" },
      executionStore: new JsonFileExecutionStore(storePath),
    });
    const listResponse = await restarted.inject({
      method: "GET",
      url: `/v1/executions?accountIdHash=${accountIdHash}`,
    });
    const records = ExecutionHistoryListSchema.parse(listResponse.json());
    expect(records).toHaveLength(1);
    expect(records[0]?.offerSnapshotHash).toBe(snapshotHash);

    const otherAccountResponse = await restarted.inject({
      method: "GET",
      url: `/v1/executions?accountIdHash=${"e".repeat(64)}`,
    });
    expect(ExecutionHistoryListSchema.parse(otherAccountResponse.json())).toEqual([]);

    const detailResponse = await restarted.inject({
      method: "GET",
      url: `/v1/executions/${executionId}?accountIdHash=${accountIdHash}`,
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(ExecutionHistoryRecordSchema.parse(detailResponse.json()).offer.title).toBe(offer.title);

    const persisted = await readFile(storePath, "utf8");
    expect(persisted).not.toContain("priceMaxKrw");
    expect(persisted).not.toContain('"salt"');
    await restarted.close();
  });

  it("rejects private criteria in the history payload", async () => {
    const app = buildApp({ environment: { JEV_PROVIDER: "mock" } });
    const searchResponse = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: { intentId: "intent-private-leak", publicRequirement },
    });
    const offer = SearchResponseSchema.parse(searchResponse.json()).offers[0]!.offer;
    const response = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        approvalId,
        accountIdHash,
        intentId: "intent-private-leak",
        publicRequirement,
        offer,
        offerSnapshotHash: await offerSnapshotHash(offer),
        commitRangeTransactionId: "range",
        commitVerifyTransactionId: "verify",
        approvedAt: fixedNow,
        priceMaxKrw: "2700000",
        salt: "secret",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain("2700000");
    await app.close();
  });
});
