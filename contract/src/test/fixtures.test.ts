import { describe, expect, it } from 'vitest';
import { type Ledger, PairStatus } from '../managed/intent/contract/index.js';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT,
  BUYER_KEY,
  BUYER_MAX,
  BUYER_MAX_NO_OVERLAP,
  BUYER_SALT,
  OFFER_HIT,
  OFFER_LOW,
  OFFER_SALT,
  OFFER_TOO_HIGH,
  OTHER_KEY,
  SELLER_INTENT,
  SELLER_KEY,
  SELLER_MIN,
  SELLER_SALT,
  buyerRange,
  sellerRange,
} from './fixtures.js';

// Flatten every ledger row into one string so a price can be searched for.
const ledgerText = (l: Ledger): string => {
  const rows: unknown[] = [];
  for (const [k, v] of l.ranges) rows.push([k, v]);
  for (const k of l.ownerItems) rows.push(k);
  for (const [k, v] of l.pairs) rows.push([k, v]);
  return JSON.stringify(rows, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Uint8Array) return Buffer.from(value).toString('hex');
    return value;
  });
};

const withRanges = async (buyerMax: bigint): Promise<IntentSimulator> => {
  const sim = await IntentSimulator.create(BUYER_KEY);
  await sim.commitRange({ ...buyerRange, limit: buyerMax, salt: BUYER_SALT });
  await sim.as(SELLER_KEY).commitRange({ ...sellerRange, limit: SELLER_MIN, salt: SELLER_SALT });
  return sim.as(BUYER_KEY);
};

const buyerOffer = (offer: bigint, buyerMax: bigint = BUYER_MAX) => ({
  buyerIntentId: BUYER_INTENT,
  sellerIntentId: SELLER_INTENT,
  buyerMax,
  buyerSalt: BUYER_SALT,
  offer,
  offerSalt: OFFER_SALT,
});

const sellerProof = (pairId: Uint8Array, offer: bigint) => ({
  pairId,
  sellerMin: SELLER_MIN,
  sellerSalt: SELLER_SALT,
  offer,
  offerSalt: OFFER_SALT,
});

describe('spec section 13 fixtures', () => {
  it('Hit: 1,000,000 / 800,000 / 900,000 opens at 900,000', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    await sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    const l = await sim.as(BUYER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });

    const pair = l.pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Opened);
    expect(pair.fillPrice).toBe(OFFER_HIT);
  });

  it('Low offer: 750,000 stays Offered and never reaches the ledger as a number', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer(buyerOffer(OFFER_LOW));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    await expect(sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_LOW)))
      .rejects.toThrow(/offer below seller limit/);

    const l = sim.ledger();
    expect(l.pairs.lookup(pairId).status).toBe(PairStatus.Offered);
    expect(ledgerText(l)).not.toContain(OFFER_LOW.toString());
  });

  it('No overlap: 700,000 / 800,000 cannot produce a Verified pair', async () => {
    const sim = await withRanges(BUYER_MAX_NO_OVERLAP);

    await expect(sim.commitOffer(buyerOffer(OFFER_TOO_HIGH, BUYER_MAX_NO_OVERLAP)))
      .rejects.toThrow(/offer above buyer limit/);

    await sim.commitOffer(buyerOffer(BUYER_MAX_NO_OVERLAP, BUYER_MAX_NO_OVERLAP));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    await expect(sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, BUYER_MAX_NO_OVERLAP)))
      .rejects.toThrow(/offer below seller limit/);
    expect(sim.ledger().pairs.lookup(pairId).status).toBe(PairStatus.Offered);
  });

  it('Re-offer: a second commitOffer for the same pair is refused', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer(buyerOffer(OFFER_LOW));
    await expect(sim.commitOffer(buyerOffer(OFFER_HIT))).rejects.toThrow(/pair already has an offer/);
  });

  it('Tamper: a limit that does not open C_seller, or a price that does not open C_offer, is refused', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);

    await expect(sim.as(SELLER_KEY).verifySellerSide({ ...sellerProof(pairId, OFFER_HIT), sellerMin: 700_000n }))
      .rejects.toThrow(/seller range does not open/);

    await sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    await expect(sim.openOffer({ pairId, offer: 950_000n, offerSalt: OFFER_SALT })).rejects.toThrow(/offer does not open/);
    expect(sim.ledger().pairs.lookup(pairId).fillPrice).toBe(0n);
  });

  it('Privacy: limits never appear on the ledger, the offer only after open', async () => {
    const sim = await withRanges(BUYER_MAX);
    const afterRanges = ledgerText(sim.ledger());
    expect(afterRanges).not.toContain(BUYER_MAX.toString());
    expect(afterRanges).not.toContain(SELLER_MIN.toString());

    await sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    await sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));
    const beforeOpen = ledgerText(sim.ledger());
    expect(beforeOpen).not.toContain(OFFER_HIT.toString());
    expect(beforeOpen).not.toContain(BUYER_MAX.toString());
    expect(beforeOpen).not.toContain(SELLER_MIN.toString());

    await sim.openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT });
    const afterOpen = ledgerText(sim.ledger());
    expect(afterOpen).toContain(OFFER_HIT.toString());
    expect(afterOpen).not.toContain(BUYER_MAX.toString());
    expect(afterOpen).not.toContain(SELLER_MIN.toString());
  });

  it('Third-party open: a wallet that is neither buyer nor seller cannot open a Verified pair', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer(buyerOffer(OFFER_HIT));
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);
    await sim.as(SELLER_KEY).verifySellerSide(sellerProof(pairId, OFFER_HIT));

    await expect(sim.as(OTHER_KEY).openOffer({ pairId, offer: OFFER_HIT, offerSalt: OFFER_SALT }))
      .rejects.toThrow(/caller is not buyer or seller/);
    const pair = sim.ledger().pairs.lookup(pairId);
    expect(pair.status).toBe(PairStatus.Verified);
    expect(pair.fillPrice).toBe(0n);
  });

  it('Salt reuse: the same value and salt give different range and offer commitments', async () => {
    const sim = await withRanges(BUYER_MAX);
    await sim.commitOffer({ ...buyerOffer(BUYER_MAX), offerSalt: BUYER_SALT });
    const pairId = sim.pairIdOf(BUYER_INTENT, SELLER_INTENT);

    const l = sim.ledger();
    expect(l.ranges.lookup(BUYER_INTENT).commitment).not.toEqual(l.pairs.lookup(pairId).offerCommit);
  });
});
