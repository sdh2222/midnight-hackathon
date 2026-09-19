import { describe, expect, it } from 'vitest';
import { PairStatus, Role } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_SALT,
  OTHER_INTENT,
  OTHER_ITEM,
  OTHER_KEY,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

const setup = async (): Promise<IntentSimulator> => {
  const sim = await IntentSimulator.create(BUYER_KEY);
  await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  await sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  return sim.as(BUYER_KEY);
};

const offer = {
  buyerIntentId: BUYER_INTENT,
  sellerIntentId: SELLER_INTENT,
  buyerMax: BUYER_MAX,
  buyerSalt: BUYER_SALT,
  offer: OFFER_HIT,
  offerSalt: OFFER_SALT,
};

describe('commitOffer', () => {
  it('creates an Offered pair with a commitment and fillPrice 0', async () => {
    const sim = await setup();
    const l = await sim.commitOffer(offer);
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);

    expect(l.pairs.member(pairId)).toBe(true);
    const pair = l.pairs.lookup(pairId);
    expect(pair.buyerIntentId).toEqual(BUYER_INTENT);
    expect(pair.sellerIntentId).toEqual(SELLER_INTENT);
    expect(pair.status).toBe(PairStatus.Offered);
    expect(pair.fillPrice).toBe(0n);
    expect(pair.offerCommit).toHaveLength(32);
    expect(Object.keys(pair).sort()).toEqual(
      ['buyerIntentId', 'fillPrice', 'offerCommit', 'sellerIntentId', 'status'],
    );
  });

  it('accepts an offer equal to buyerMax', async () => {
    const sim = await setup();
    const l = await sim.commitOffer({ ...offer, offer: BUYER_MAX });
    expect(l.pairs.size()).toBe(1n);
  });

  it('rejects when the seller range is missing', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    await expect(sim.commitOffer(offer)).rejects.toThrow(/seller range missing/);
  });

  it('rejects when the buyer range is missing', async () => {
    const sim = await IntentSimulator.create(SELLER_KEY);
    await sim.commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
    await expect(sim.as(BUYER_KEY).commitOffer(offer)).rejects.toThrow(/buyer range missing/);
  });

  it('rejects when the two intents have the wrong roles', async () => {
    const sim = await setup();
    await expect(sim.as(SELLER_KEY).commitOffer({
      ...offer,
      buyerIntentId: SELLER_INTENT,
      sellerIntentId: BUYER_INTENT,
      buyerMax: SELLER_MIN,
      buyerSalt: SELLER_SALT,
    })).rejects.toThrow(/buyer intent is not a buyer/);
  });

  it('rejects when items differ', async () => {
    const sim = await setup();
    await sim.as(OTHER_KEY).commitRange({
      ...sellerRange,
      intentId: OTHER_INTENT,
      itemId: OTHER_ITEM,
      limit: SELLER_MIN,
      salt: SELLER_SALT,
    });
    await expect(sim.as(BUYER_KEY).commitOffer({ ...offer, sellerIntentId: OTHER_INTENT }))
      .rejects.toThrow(/item mismatch/);
  });

  it('rejects when quantities differ', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
    await sim.as(SELLER_KEY).commitRange({ ...sellerRange, quantity: 2n, limit: SELLER_MIN, salt: SELLER_SALT });
    await expect(sim.as(BUYER_KEY).commitOffer(offer)).rejects.toThrow(/quantity mismatch/);
  });

  it('rejects when the seller intent is not a seller', async () => {
    const sim = await setup();
    await sim.as(OTHER_KEY).commitRange({
      ...buyerRange,
      intentId: OTHER_INTENT,
      limit: BUYER_MAX,
      salt: BUYER_SALT,
    });
    await expect(sim.as(BUYER_KEY).commitOffer({ ...offer, sellerIntentId: OTHER_INTENT }))
      .rejects.toThrow(/seller intent is not a seller/);
  });

  it('rejects a caller that does not own the buyer intent', async () => {
    const sim = await setup();
    await expect(sim.as(OTHER_KEY).commitOffer(offer)).rejects.toThrow(/caller is not the buyer/);
  });

  it('rejects when buyerMax or buyerSalt does not open the buyer commitment', async () => {
    const sim = await setup();
    await expect(sim.commitOffer({ ...offer, buyerMax: BUYER_MAX + 1n })).rejects.toThrow(/buyer range does not open/);
    await expect(sim.commitOffer({ ...offer, buyerSalt: SELLER_SALT })).rejects.toThrow(/buyer range does not open/);
  });

  it('rejects offer 0', async () => {
    const sim = await setup();
    await expect(sim.commitOffer({ ...offer, offer: 0n })).rejects.toThrow(/offer must be positive/);
  });

  it('rejects an offer above buyerMax', async () => {
    const sim = await setup();
    await expect(sim.commitOffer({ ...offer, offer: BUYER_MAX + 1n })).rejects.toThrow(/offer above buyer limit/);
  });

  it('rejects a second offer for the same pair', async () => {
    const sim = await setup();
    await sim.commitOffer(offer);
    await expect(sim.commitOffer({ ...offer, offer: OFFER_HIT + 1n })).rejects.toThrow(/pair already has an offer/);
  });

  it('roles stay as committed', async () => {
    const l = (await setup()).ledger();
    expect(l.ranges.lookup(BUYER_INTENT).role).toBe(Role.Buyer);
    expect(l.ranges.lookup(SELLER_INTENT).role).toBe(Role.Seller);
  });
});
