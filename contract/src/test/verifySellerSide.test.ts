import { describe, expect, it } from 'vitest';
import { PairStatus } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_LOW,
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

const setup = async (offerAmount: bigint = OFFER_HIT): Promise<Setup> => {
  const sim = await IntentSimulator.create(BUYER_KEY);
  await sim.commitRange({ ...buyerRange, limit: BUYER_MAX, salt: BUYER_SALT });
  await sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  await sim.as(BUYER_KEY).commitOffer({
    buyerIntentId: BUYER_INTENT,
    sellerIntentId: SELLER_INTENT,
    buyerMax: BUYER_MAX,
    buyerSalt: BUYER_SALT,
    offer: offerAmount,
    offerSalt: OFFER_SALT,
  });
  return { sim: sim.as(SELLER_KEY), pairId: sim.pairIdOf(BUYER_INTENT, SELLER_INTENT) };
};

const sellerArgs = (pairId: Uint8Array, offerAmount: bigint = OFFER_HIT) => ({
  pairId,
  sellerMin: SELLER_MIN,
  sellerSalt: SELLER_SALT,
  offer: offerAmount,
  offerSalt: OFFER_SALT,
});

describe('verifySellerSide', () => {
  it('moves the pair to Verified and keeps fillPrice 0', async () => {
    const { sim, pairId } = await setup();
    const l = await sim.verifySellerSide(sellerArgs(pairId));
    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Verified);
    expect(pair.fillPrice).toBe(0n);
  });

  it('accepts an offer equal to sellerMin', async () => {
    const { sim, pairId } = await setup(SELLER_MIN);
    const l = await sim.verifySellerSide(sellerArgs(pairId, SELLER_MIN));
    expect(l.pairs.lookup(pairId).status).toBe(PairStatus.Verified);
  });

  it('rejects an unknown pair', async () => {
    const { sim } = await setup();
    await expect(sim.verifySellerSide(sellerArgs(new Uint8Array(32)))).rejects.toThrow(/pair missing/);
  });

  it('rejects a pair that is already Verified', async () => {
    const { sim, pairId } = await setup();
    await sim.verifySellerSide(sellerArgs(pairId));
    await expect(sim.verifySellerSide(sellerArgs(pairId))).rejects.toThrow(/pair is not in Offered state/);
  });

  it('rejects a caller that does not own the seller intent', async () => {
    const { sim, pairId } = await setup();
    await expect(sim.as(OTHER_KEY).verifySellerSide(sellerArgs(pairId))).rejects.toThrow(/caller is not the seller/);
    await expect(sim.as(BUYER_KEY).verifySellerSide(sellerArgs(pairId))).rejects.toThrow(/caller is not the seller/);
  });

  it('rejects when sellerMin or sellerSalt does not open the seller commitment', async () => {
    const { sim, pairId } = await setup();
    await expect(sim.verifySellerSide({ ...sellerArgs(pairId), sellerMin: SELLER_MIN - 1n }))
      .rejects.toThrow(/seller range does not open/);
    await expect(sim.verifySellerSide({ ...sellerArgs(pairId), sellerSalt: BUYER_SALT }))
      .rejects.toThrow(/seller range does not open/);
  });

  it('rejects when the offer or offerSalt does not open the offer commitment', async () => {
    const { sim, pairId } = await setup();
    await expect(sim.verifySellerSide({ ...sellerArgs(pairId), offer: OFFER_HIT + 1n }))
      .rejects.toThrow(/offer does not open/);
    await expect(sim.verifySellerSide({ ...sellerArgs(pairId), offerSalt: BUYER_SALT }))
      .rejects.toThrow(/offer does not open/);
  });

  it('cannot be proven when the offer is below sellerMin, and the ledger stays Offered', async () => {
    const { sim, pairId } = await setup(OFFER_LOW);
    await expect(sim.verifySellerSide(sellerArgs(pairId, OFFER_LOW))).rejects.toThrow(/offer below seller limit/);
    const pair = sim.ledger().pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Offered);
    expect(pair.fillPrice).toBe(0n);
  });
});
