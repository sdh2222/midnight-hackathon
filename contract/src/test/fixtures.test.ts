import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT, BUYER_KEY, BUYER_SALT, OFFER_HIT, OFFER_OVER,
  OFFER_SALT, PRICE_MAX, ZERO32, buyerRange,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };
const verify = (offerPrice: bigint) => ({
  intentId: BUYER_INTENT, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n,
  salt: BUYER_SALT, offerPrice, offerSource: ZERO32, offerDate: 0n, offerSalt: OFFER_SALT,
});

describe('spec fixtures', () => {
  it('accepts a 1,200,000 offer under a hidden 1,500,000 limit', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const ledger = await sim.commitVerify(verify(OFFER_HIT));
    expect(ledger.hasOffer).toBe(true);
    expect(ledger.offerIntentId).toEqual(BUYER_INTENT);
    expect(ledger.offerCommitmentValue).toEqual(
      sim.offerCommitment(OFFER_HIT, ZERO32, 0n, OFFER_SALT),
    );
  });

  it('rejects a 1,800,000 offer without exposing either amount in ledger JSON', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitVerify(verify(OFFER_OVER))).rejects.toThrow(/offer above buyer limit/);
    const text = JSON.stringify(sim.ledger(), (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? Buffer.from(value).toString('hex') : value,
    );
    expect(text).not.toMatch(/1500000|1200000|1800000/);
    expect(sim.ledger().hasOffer).toBe(false);
  });
});
