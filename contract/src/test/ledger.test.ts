import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import { BUYER_KEY, BUYER_SALT, OFFER_SALT, PRICE_MAX, ZERO32 } from './fixtures.js';

describe('compiled contract', () => {
  it('starts with empty ledger maps', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = sim.ledger();
    expect(l.ranges.isEmpty()).toBe(true);
    expect(l.ownerItems.isEmpty()).toBe(true);
    expect(l.offers.isEmpty()).toBe(true);
  });

  it('rangeCommitment and offerCommitment differ for the same fields and salt', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const range = sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT);
    const offer = sim.offerCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT);
    expect(range).toHaveLength(32);
    expect(offer).toHaveLength(32);
    expect(range).toEqual(sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT));
    expect(range).not.toEqual(offer);
    expect(range).not.toEqual(sim.offerCommitment(PRICE_MAX, ZERO32, 0n, OFFER_SALT));
  });
});
