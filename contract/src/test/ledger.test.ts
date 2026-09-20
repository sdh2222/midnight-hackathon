import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import { BUYER_INTENT, BUYER_KEY, BUYER_MAX, BUYER_SALT, SELLER_INTENT } from './fixtures.js';

describe('compiled contract', () => {
  it('starts with empty ledger maps', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = sim.ledger();
    expect(l.ranges.isEmpty()).toBe(true);
    expect(l.ownerItems.isEmpty()).toBe(true);
    expect(l.pairs.isEmpty()).toBe(true);
  });

  it('pairIdOf is deterministic and order-sensitive', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const a = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    const b = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    const c = sim.pairIdOf(SELLER_INTENT, BUYER_INTENT);
    expect(a).toHaveLength(32);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('rangeCommitment and offerCommitment differ for the same value and salt', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const range = sim.rangeCommitment(BUYER_MAX, BUYER_SALT);
    const offer = sim.offerCommitment(BUYER_MAX, BUYER_SALT);
    expect(range).toHaveLength(32);
    expect(offer).toHaveLength(32);
    expect(range).toEqual(sim.rangeCommitment(BUYER_MAX, BUYER_SALT));
    expect(range).not.toEqual(offer);
  });
});
