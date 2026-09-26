import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT, BUYER_KEY, BUYER_SALT, OTHER_INTENT, OTHER_SALT,
  PRICE_MAX, ZERO32, buyerRange,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };

describe('commitRange', () => {
  it('stores public metadata and only a commitment for the private budget', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const ledger = await sim.commitRange(lock);
    expect(ledger.hasRange).toBe(true);
    expect(ledger.rangeIntentId).toEqual(BUYER_INTENT);
    expect(ledger.rangeItemId).toEqual(buyerRange.itemId);
    expect(ledger.rangeQuantity).toBe(1n);
    expect(ledger.rangeVersion).toBe(1n);
    expect(ledger.rangeCommitmentValue).toEqual(
      sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT),
    );
    expect(ledger.hasOffer).toBe(false);
  });

  it('uses the salt to produce distinct commitments', async () => {
    const a = await (await IntentSimulator.create(BUYER_KEY)).commitRange(lock);
    const b = await (await IntentSimulator.create(BUYER_KEY)).commitRange({ ...lock, salt: OTHER_SALT });
    expect(a.rangeCommitmentValue).not.toEqual(b.rangeCommitmentValue);
  });

  it('rejects quantity 0 and a non-positive private budget', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await expect(sim.commitRange({ ...lock, quantity: 0n })).rejects.toThrow(/quantity must be positive/);
    await expect(sim.commitRange({ ...lock, priceMax: 0n })).rejects.toThrow(/limit must be positive/);
  });

  it('allows only one active intent per deployed MVP contract', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitRange({ ...lock, intentId: OTHER_INTENT, salt: OTHER_SALT }))
      .rejects.toThrow(/intent already committed/);
  });
});
