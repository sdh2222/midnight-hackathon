import { describe, expect, it } from 'vitest';
import { Role } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OTHER_INTENT,
  OTHER_ITEM,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  hexToBytes,
  sellerRange,
} from './fixtures.js';

describe('commitRange', () => {
  it('stores a buyer row with public fields, owner, and a commitment but no limit', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });

    expect(l.ranges.member(BUYER_INTENT)).toBe(true);
    const row = l.ranges.lookup(BUYER_INTENT);
    expect(row.owner).toEqual(hexToBytes(BUYER_KEY));
    expect(row.role).toBe(Role.Buyer);
    expect(row.itemId).toEqual(buyerRange.itemId);
    expect(row.quantity).toBe(1n);
    expect(row.version).toBe(1n);
    expect(row.commitment).toHaveLength(32);
    expect(Object.keys(row).sort()).toEqual(
      ['commitment', 'currency', 'itemId', 'owner', 'quantity', 'role', 'version'],
    );
    expect(l.ownerItems.size()).toBe(1n);
  });

  it('lets a different wallet commit the other side of the same item', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const l = await sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });

    expect(l.ranges.size()).toBe(2n);
    expect(l.ranges.lookup(SELLER_INTENT).role).toBe(Role.Seller);
    expect(l.ranges.lookup(SELLER_INTENT).owner).toEqual(hexToBytes(SELLER_KEY));
    expect(l.ownerItems.size()).toBe(2n);
  });

  it('different commitments for the same limit with different salts', async () => {
    const a = await (await IntentSimulator.create(BUYER_KEY)).commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const b = await (await IntentSimulator.create(BUYER_KEY)).commitRange({ ...buyerRange, limit: BUYER_MAX, salt: SELLER_SALT });
    expect(a.ranges.lookup(BUYER_INTENT).commitment).not.toEqual(b.ranges.lookup(BUYER_INTENT).commitment);
  });

  it('stores exactly rangeCommitment(limit, salt)', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    const l = await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(l.ranges.lookup(BUYER_INTENT).commitment).toEqual(sim.rangeCommitment(BUYER_MAX, BUYER_SALT));
  });

  it('rejects quantity 0', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await expect(sim.commitRange({ ...buyerRange, quantity: 0n, limit: BUYER_MAX, salt: BUYER_SALT }))
      .rejects.toThrow(/quantity must be positive/);
  });

  it('rejects limit 0', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await expect(sim.commitRange({ ...buyerRange, limit: 0n, salt: BUYER_SALT }))
      .rejects.toThrow(/limit must be positive/);
  });

  it('rejects a second commit for the same intentId', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    await expect(sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT }))
      .rejects.toThrow(/intent already committed/);
  });

  it('rejects the same wallet committing a second range for the same item', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    await expect(sim.commitRange({ ...buyerRange, intentId: OTHER_INTENT, limit: 900_000n, salt: SELLER_SALT }))
      .rejects.toThrow(/owner already has a range for this item/);
  });

  it('allows the same wallet to commit a range for a different item', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    const l = await sim.commitRange({ ...buyerRange, intentId: OTHER_INTENT, itemId: OTHER_ITEM, limit: BUYER_MAX, salt: BUYER_SALT });
    expect(l.ranges.size()).toBe(2n);
  });
});
