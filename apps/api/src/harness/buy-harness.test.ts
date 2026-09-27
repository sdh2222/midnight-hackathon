import { Currency } from "@midnight-hackathon/intent-contract";
import { IntentSimulator } from "@midnight-hackathon/intent-contract/simulator";
import {
  ExecutionHistoryRecordSchema,
  PublicRequirementSchema,
  SearchResponseSchema,
  ZERO_BYTES_32,
  bytesToHex,
  dateToUnixDay,
  hashToBytes,
  hexToBytes,
  offerSnapshotHash,
  sha256Hex,
} from "@midnight-hackathon/shared";
import { describe, expect, it } from "vitest";
import { offerFit } from "../../../web/src/flow/fit.ts";
import { buildApp } from "../app.js";

const capKrw = 2_700_000;
const approvedAt = "2026-09-27T12:00:00.000Z";
const buyerKey = "11".repeat(32);
const salt = new Uint8Array(32).fill(9);
const offerSalt = new Uint8Array(32).fill(4);

const publicRequirement = PublicRequirementSchema.parse({
  item: "Industrial nitrile gloves",
  quantity: 10_000,
  unit: "piece",
  destinationCountry: "KR",
  keywords: ["nitrile gloves", "industrial", "powder-free"],
});

describe("buy harness", () => {
  it("locks the cap, sorts in public, and keeps one fitting row", async () => {
    const intentId = "intent-nitrile-10000";
    const intentIdBytes = await hashToBytes(intentId);
    const itemId = await hashToBytes(publicRequirement.item.trim().toLowerCase());
    const sourceId = ZERO_BYTES_32.slice();
    const dateMax = dateToUnixDay(publicRequirement.requiredBy);
    const searchRequest = { intentId, publicRequirement };

    expect(Object.keys(searchRequest).sort()).toEqual(["intentId", "publicRequirement"]);
    expect(JSON.stringify(searchRequest)).not.toContain(String(capKrw));
    expect(JSON.stringify(searchRequest)).not.toContain(bytesToHex(salt));

    const ids = [
      "30b2072b-d82e-481c-b187-8c721fa1de65",
      "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    ];
    let nextId = 0;
    const app = buildApp({
      now: () => approvedAt,
      createId: () => {
        const id = ids[nextId];
        nextId += 1;
        if (!id) throw new Error("The harness ran out of ids");
        return id;
      },
      environment: { CATALOG_PROVIDER: "mock", JEV_PROVIDER: "mock" },
    });

    const simulator = await IntentSimulator.create(buyerKey);
    const locked = await simulator.commitRange({
      intentId: intentIdBytes,
      itemId,
      quantity: BigInt(publicRequirement.quantity),
      currency: Currency.KRW,
      version: 1n,
      priceMax: BigInt(capKrw),
      sourceId,
      dateMax,
      salt,
    });
    const rangeTransactionId = bytesToHex(locked.rangeCommitmentValue);
    expect(locked.hasRange).toBe(true);
    expect(locked.hasOffer).toBe(false);

    const search = await app.inject({
      method: "POST",
      url: "/v1/searches",
      payload: searchRequest,
    });
    expect(search.statusCode).toBe(200);
    const ranked = SearchResponseSchema.parse(search.json());
    expect(ranked.intentId).toBe(intentId);

    const firstFit = ranked.offers.find(
      ({ offer }) => offerFit(offer, capKrw, "") === "fits",
    );
    const overCap = ranked.offers.find(
      ({ offer }) => offerFit(offer, capKrw, "") === "over-cap",
    );
    expect(firstFit).toBeDefined();
    expect(overCap).toBeDefined();
    if (!firstFit || !overCap) return;

    const rejected = await IntentSimulator.create(buyerKey);
    await rejected.commitRange({
      intentId: intentIdBytes,
      itemId,
      quantity: BigInt(publicRequirement.quantity),
      currency: Currency.KRW,
      version: 1n,
      priceMax: BigInt(capKrw),
      sourceId,
      dateMax,
      salt,
    });
    await expect(rejected.commitVerify({
      intentId: intentIdBytes,
      priceMax: BigInt(capKrw),
      sourceId,
      dateMax,
      salt,
      offerPrice: BigInt(overCap.offer.convertedTotalKrw),
      offerSource: hexToBytes(overCap.offer.sourceId),
      offerDate: dateToUnixDay(overCap.offer.deliveryDate),
      offerSalt,
    })).rejects.toThrow(/offer above buyer limit/);
    expect(rejected.ledger().hasRange).toBe(true);
    expect(rejected.ledger().hasOffer).toBe(false);
    expect(bytesToHex(rejected.ledger().rangeCommitmentValue)).toBe(rangeTransactionId);

    const verified = await simulator.commitVerify({
      intentId: intentIdBytes,
      priceMax: BigInt(capKrw),
      sourceId,
      dateMax,
      salt,
      offerPrice: BigInt(firstFit.offer.convertedTotalKrw),
      offerSource: hexToBytes(firstFit.offer.sourceId),
      offerDate: dateToUnixDay(firstFit.offer.deliveryDate),
      offerSalt,
    });
    const verifyTransactionId = bytesToHex(verified.offerCommitmentValue);
    expect(verified.hasOffer).toBe(true);
    expect(verified.offerIntentId).toEqual(intentIdBytes);
    expect(verified.offerCommitmentValue).toEqual(simulator.offerCommitment(
      BigInt(firstFit.offer.convertedTotalKrw),
      hexToBytes(firstFit.offer.sourceId),
      dateToUnixDay(firstFit.offer.deliveryDate),
      offerSalt,
    ));
    expect(bytesToHex(verified.rangeCommitmentValue)).toBe(rangeTransactionId);

    const accountIdHash = await sha256Hex("privy:harness-buyer");
    const created = await app.inject({
      method: "POST",
      url: "/v1/executions",
      payload: {
        approvalId: "5980675d-1412-4bbb-b5f4-57bcbb59245d",
        accountIdHash,
        intentId,
        publicRequirement,
        offer: firstFit.offer,
        offerSnapshotHash: await offerSnapshotHash(firstFit.offer),
        commitRangeTransactionId: rangeTransactionId,
        commitVerifyTransactionId: verifyTransactionId,
        approvedAt,
      },
    });
    expect(created.statusCode).toBe(201);
    const saved = ExecutionHistoryRecordSchema.parse(created.json());
    expect(saved.offer.offerId).toBe(firstFit.offer.offerId);
    expect(saved.commitRangeTransactionId).toBe(rangeTransactionId);
    expect(saved.commitVerifyTransactionId).toBe(verifyTransactionId);

    const listed = await app.inject({
      method: "GET",
      url: `/v1/executions?accountIdHash=${accountIdHash}`,
    });
    expect(listed.statusCode).toBe(200);
    const history = ExecutionHistoryRecordSchema.array().parse(listed.json());
    const kept = history.find((record) => record.executionId === saved.executionId);
    expect(kept?.offer.offerId).toBe(firstFit.offer.offerId);
    expect(kept?.commitRangeTransactionId).toBe(rangeTransactionId);
    expect(kept?.commitVerifyTransactionId).toBe(verifyTransactionId);
    const serialized = JSON.stringify(kept);
    expect(serialized).not.toContain(bytesToHex(salt));
    expect(serialized).not.toContain(bytesToHex(offerSalt));
    expect(serialized).not.toContain(String(capKrw));
    expect(serialized).not.toContain("priceMax");

    await app.close();
  });
});
