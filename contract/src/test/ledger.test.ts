import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import { BUYER_KEY, BUYER_SALT, OFFER_SALT, PRICE_MAX, ZERO32 } from './fixtures.js';

describe('compiled contract', () => {
  it('starts without an active range or verified offer', async () => {
    const ledger = (await IntentSimulator.create(BUYER_KEY)).ledger();
    expect(ledger.hasRange).toBe(false);
    expect(ledger.hasOffer).toBe(false);
  });

  it('produces deterministic salted commitments', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const range = sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT);
    expect(range).toHaveLength(32);
    expect(range).toEqual(sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT));
    expect(range).not.toEqual(sim.offerCommitment(PRICE_MAX, ZERO32, 0n, OFFER_SALT));
  });
});
