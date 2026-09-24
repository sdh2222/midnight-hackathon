import { describe, expect, it } from 'vitest';
import { OfferStatus } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_SALT,
  DATE_MAX,
  OFFER_DATE_LATE,
  OFFER_DATE_OK,
  OFFER_HIT,
  OFFER_OVER,
  OFFER_SALT,
  OTHER_KEY,
  OTHER_SALT,
  PRICE_MAX,
  SOURCE_A,
  SOURCE_B,
  ZERO32,
  buyerRange,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };

const hit = {
  intentId: BUYER_INTENT,
  priceMax: PRICE_MAX,
  sourceId: ZERO32,
  dateMax: 0n,
  salt: BUYER_SALT,
  offerPrice: OFFER_HIT,
  offerSource: ZERO32,
  offerDate: 0n,
  offerSalt: OFFER_SALT,
};

describe('commitVerify', () => {
  it('writes C_offer and Verified when A1 is 1,200,000 under a 1,500,000 lock', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const l = await sim.commitVerify(hit);

    expect(l.offers.member(BUYER_INTENT)).toBe(true);
    const row = l.offers.lookup(BUYER_INTENT);
    expect(row.status).toBe(OfferStatus.Verified);
    expect(row.offerCommit).toEqual(
      sim.offerCommitment(OFFER_HIT, ZERO32, 0n, OFFER_SALT),
    );
  });

  it('rejects a wrong budget (re-hash != C)', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitVerify({ ...hit, priceMax: 1_400_000n }))
      .rejects.toThrow(/range does not open/);
    expect(sim.ledger().offers.isEmpty()).toBe(true);
    expect(sim.ledger().ranges.lookup(BUYER_INTENT).commitment).toEqual(
      sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT),
    );
  });

  it('rejects a wrong salt (re-hash != C)', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitVerify({ ...hit, salt: OTHER_SALT }))
      .rejects.toThrow(/range does not open/);
  });

  it('rejects A2 1,800,000 as above the lock and leaves C unchanged', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const before = await sim.commitRange(lock);
    const c = before.ranges.lookup(BUYER_INTENT).commitment;
    await expect(sim.commitVerify({ ...hit, offerPrice: OFFER_OVER }))
      .rejects.toThrow(/offer above buyer limit/);
    expect(sim.ledger().offers.isEmpty()).toBe(true);
    expect(sim.ledger().ranges.lookup(BUYER_INTENT).commitment).toEqual(c);
  });

  it('rejects a third-party caller', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.as(OTHER_KEY).commitVerify(hit))
      .rejects.toThrow(/caller is not the owner/);
  });

  it('rejects a second verify on the same intentId', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await sim.commitVerify(hit);
    await expect(sim.commitVerify({ ...hit, offerSalt: OTHER_SALT }))
      .rejects.toThrow(/intent already verified/);
  });

  it('treats zero source and date as unconstrained', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const l = await sim.commitVerify({
      ...hit,
      offerSource: SOURCE_B,
      offerDate: OFFER_DATE_LATE,
    });
    expect(l.offers.lookup(BUYER_INTENT).status).toBe(OfferStatus.Verified);
  });

  it('rejects a source mismatch when T0 locked a non-zero sourceId', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...lock, sourceId: SOURCE_A });
    await expect(sim.commitVerify({ ...hit, sourceId: SOURCE_A, offerSource: SOURCE_B }))
      .rejects.toThrow(/source mismatch/);
  });

  it('accepts a matching source when T0 locked a non-zero sourceId', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...lock, sourceId: SOURCE_A });
    const l = await sim.commitVerify({ ...hit, sourceId: SOURCE_A, offerSource: SOURCE_A });
    expect(l.offers.lookup(BUYER_INTENT).status).toBe(OfferStatus.Verified);
  });

  it('rejects a late date when T0 locked a non-zero dateMax', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...lock, dateMax: DATE_MAX });
    await expect(sim.commitVerify({
      ...hit,
      dateMax: DATE_MAX,
      offerDate: OFFER_DATE_LATE,
    })).rejects.toThrow(/date after buyer max/);
  });

  it('accepts an on-time date when T0 locked a non-zero dateMax', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...lock, dateMax: DATE_MAX });
    const l = await sim.commitVerify({
      ...hit,
      dateMax: DATE_MAX,
      offerDate: OFFER_DATE_OK,
    });
    expect(l.offers.lookup(BUYER_INTENT).status).toBe(OfferStatus.Verified);
  });

  it('rejects offerPrice 0', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitVerify({ ...hit, offerPrice: 0n }))
      .rejects.toThrow(/offer must be positive/);
  });
});
