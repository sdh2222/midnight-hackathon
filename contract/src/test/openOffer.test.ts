import { describe, expect, it } from 'vitest';
import { PairStatus } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_SALT,
  OTHER_KEY,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

type Setup = { sim: IntentSimulator; pairId: Uint8Array };

const offered = async (): Promise<Setup> => {
  const sim = await IntentSimulator.create(BUYER_KEY);
  await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  await sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  await sim.as(BUYER_KEY).commitOffer({
    buyerIntentId: BUYER_INTENT,
    sellerIntentId: SELLER_INTENT,
    buyerMax: BUYER_MAX,
    buyerSalt: BUYER_SALT,
    offer: OFFER_HIT,
    offerSalt: OFFER_SALT,
  });
  return { sim, pairId: sim.pairIdOf(BUYER_INTENT, SELLER_INTENT) };
};

const verified = async (): Promise<Setup> => {
  const s = await offered();
  await s.sim.as(SELLER_KEY).verifySellerSide({
    pairId: s.pairId,
    sellerMin: SELLER_MIN,
    sellerSalt: SELLER_SALT,
    offer: OFFER_HIT,
    offerSalt: OFFER_SALT,
  });
  return s;
};

describe('openOffer', () => {
  it('buyer opens a Verified pair and the fill price becomes public', async () => {
    const { sim, pairId } = await verified();
    const l = await sim.as(BUYER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Opened);
    expect(pair.fillPrice).toBe(OFFER_HIT);
  });

  it('seller can open too', async () => {
    const { sim, pairId } = await verified();
    const l = await sim.as(SELLER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    expect(l.pairs.lookup(pairId).fillPrice).toBe(OFFER_HIT);
  });

  it('rejects a third party even with the correct opening', async () => {
    const { sim, pairId } = await verified();
    await expect(sim.as(OTHER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .rejects.toThrow(/caller is not buyer or seller/);
    const pair = sim.ledger().pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Verified);
    expect(pair.fillPrice).toBe(0n);
  });

  it('rejects an unknown pair', async () => {
    const { sim } = await verified();
    await expect(sim.openOffer({ pairId: new Uint8Array(32), offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .rejects.toThrow(/pair missing/);
  });

  it('rejects opening a pair that is only Offered', async () => {
    const { sim, pairId } = await offered();
    await expect(sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .rejects.toThrow(/pair is not verified/);
  });

  it('rejects opening twice', async () => {
    const { sim, pairId } = await verified();
    await sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    await expect(sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .rejects.toThrow(/pair is not verified/);
  });

  it('rejects a price that does not open the offer commitment', async () => {
    const { sim, pairId } = await verified();
    await expect(sim.openOffer({ pairId, offer: 950_000n, offerSalt: OFFER_SALT })).rejects.toThrow(/offer does not open/);
    await expect(sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: BUYER_SALT })).rejects.toThrow(/offer does not open/);
    expect(sim.ledger().pairs.lookup(pairId).fillPrice).toBe(0n);
  });
});
