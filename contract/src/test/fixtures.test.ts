import { describe, expect, it } from 'vitest';
import { type Ledger, OfferStatus } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_OVER,
  OFFER_SALT,
  PRICE_MAX,
  ZERO32,
  buyerRange,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };

const verify = (offerPrice: bigint) => ({
  intentId: BUYER_INTENT,
  priceMax: PRICE_MAX,
  sourceId: ZERO32,
  dateMax: 0n,
  salt: BUYER_SALT,
  offerPrice,
  offerSource: ZERO32,
  offerDate: 0n,
  offerSalt: OFFER_SALT,
});

const ledgerText = (l: Ledger): string => {
  const rows: unknown[] = [];
  for (const [k, v] of l.ranges) rows.push([k, v]);
  for (const k of l.ownerItems) rows.push(k);
  for (const [k, v] of l.offers) rows.push([k, v]);
  return JSON.stringify(rows, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
    return value;
  });
};

describe('spec fixtures', () => {
  it('Hit: lock 1,500,000 and A1 1,200,000 writes Verified + C_offer', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const l = await sim.commitVerify(verify(OFFER_HIT));
    const row = l.offers.lookup(BUYER_INTENT);
    expect(row.status).toBe(OfferStatus.Verified);
    expect(row.offerCommit).toEqual(sim.offerCommitment(OFFER_HIT, ZERO32, 0n, OFFER_SALT));
  });

  it('Over cap: A2 1,800,000 reverts and a ledger read never contains the budget', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitVerify(verify(OFFER_OVER))).rejects.toThrow(/offer above buyer limit/);

    const text = ledgerText(sim.ledger());
    expect(text).not.toContain('1500000');
    expect(text).not.toContain('1200000');
    expect(text).not.toContain('1800000');
    expect(sim.ledger().offers.isEmpty()).toBe(true);
  });
});
