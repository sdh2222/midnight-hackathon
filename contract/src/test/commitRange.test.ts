import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_SALT,
  OTHER_INTENT,
  OTHER_ITEM,
  OTHER_SALT,
  PRICE_MAX,
  ZERO32,
  buyerRange,
  hexToBytes,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };

describe('commitRange', () => {
  it('stores a row with public fields, owner, and C but no priceMax', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = await sim.commitRange(lock);

    expect(l.ranges.member(BUYER_INTENT)).toBe(true);
    const row = l.ranges.lookup(BUYER_INTENT);
    expect(row.owner).toEqual(hexToBytes(BUYER_KEY));
    expect(row.itemId).toEqual(buyerRange.itemId);
    expect(row.quantity).toBe(1n);
    expect(row.version).toBe(1n);
    expect(row.commitment).toHaveLength(32);
    expect(Object.keys(row).sort()).toEqual(
      ['commitment', 'currency', 'itemId', 'owner', 'quantity', 'version'],
    );
    expect(l.ownerItems.size()).toBe(1n);
    expect(l.offers.isEmpty()).toBe(true);
  });

  it('stores exactly rangeCommitment(priceMax, sourceId, dateMax, salt)', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = await sim.commitRange(lock);
    expect(l.ranges.lookup(BUYER_INTENT).commitment).toEqual(
      sim.rangeCommitment(PRICE_MAX, ZERO32, 0n, BUYER_SALT),
    );
  });

  it('different commitments for the same price with different salts', async () => {
    const a = await (await IntentSimulator.create(BUYER_KEY)).commitRange(lock);
    const b = await (await IntentSimulator.create(BUYER_KEY)).commitRange({ ...lock, salt: OTHER_SALT });
    expect(a.ranges.lookup(BUYER_INTENT).commitment).not.toEqual(b.ranges.lookup(BUYER_INTENT).commitment);
  });

  it('rejects quantity 0', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await expect(sim.commitRange({ ...lock, quantity: 0n })).rejects.toThrow(/quantity must be positive/);
  });

  it('rejects priceMax 0', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await expect(sim.commitRange({ ...lock, priceMax: 0n })).rejects.toThrow(/limit must be positive/);
  });

  it('rejects a second commit for the same intentId', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitRange(lock)).rejects.toThrow(/intent already committed/);
  });

  it('rejects the same wallet committing a second range for the same item', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    await expect(sim.commitRange({ ...lock, intentId: OTHER_INTENT, priceMax: 900_000n, salt: OTHER_SALT }))
      .rejects.toThrow(/owner already has a range for this item/);
  });

  it('allows the same wallet to commit a range for a different item', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const l = await sim.commitRange({ ...lock, intentId: OTHER_INTENT, itemId: OTHER_ITEM });
    expect(l.ranges.size()).toBe(2n);
  });
});
