import { describe, expect, it } from 'vitest';
import { IntentSimulator } from './simulator.js';
import {
  BUYER_INTENT, BUYER_KEY, BUYER_SALT, OFFER_HIT, OFFER_OVER,
  OFFER_SALT, OTHER_INTENT, OTHER_SALT, PRICE_MAX, ZERO32, buyerRange,
} from './fixtures.js';

const lock = { ...buyerRange, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n, salt: BUYER_SALT };
const hit = {
  intentId: BUYER_INTENT, priceMax: PRICE_MAX, sourceId: ZERO32, dateMax: 0n,
  salt: BUYER_SALT, offerPrice: OFFER_HIT, offerSource: ZERO32, offerDate: 0n, offerSalt: OFFER_SALT,
};

describe('commitVerify', () => {
  it('proves the hidden limit opening and records an eligible offer commitment', async () => {
    const sim = await IntentSimulator.create(BUYER_KEY);
    await sim.commitRange(lock);
    const ledger = await sim.commitVerify(hit);
    expect(ledger.hasOffer).toBe(true);
    expect(ledger.offerIntentId).toEqual(BUYER_INTENT);
    expect(ledger.offerCommitmentValue).toEqual(
      sim.offerCommitment(OFFER_HIT, ZERO32, 0n, OFFER_SALT),
    );
  });

  it('rejects a wrong budget, salt, intent, or over-budget offer', async () => {
    const wrongBudget = await IntentSimulator.create(BUYER_KEY);
    await wrongBudget.commitRange(lock);
    await expect(wrongBudget.commitVerify({ ...hit, priceMax: PRICE_MAX - 1n })).rejects.toThrow(/range does not open/);

    const wrongSalt = await IntentSimulator.create(BUYER_KEY);
    await wrongSalt.commitRange(lock);
    await expect(wrongSalt.commitVerify({ ...hit, salt: OTHER_SALT })).rejects.toThrow(/range does not open/);

    const wrongIntent = await IntentSimulator.create(BUYER_KEY);
    await wrongIntent.commitRange(lock);
    await expect(wrongIntent.commitVerify({ ...hit, intentId: OTHER_INTENT })).rejects.toThrow(/range missing/);

    const over = await IntentSimulator.create(BUYER_KEY);
    await over.commitRange(lock);
    await expect(over.commitVerify({ ...hit, offerPrice: OFFER_OVER })).rejects.toThrow(/offer above buyer limit/);
    expect(over.ledger().hasOffer).toBe(false);
  });

  it('rejects offerPrice 0 and a second verification', async () => {
    const zero = await IntentSimulator.create(BUYER_KEY);
    await zero.commitRange(lock);
    await expect(zero.commitVerify({ ...hit, offerPrice: 0n })).rejects.toThrow(/offer must be positive/);

    const duplicate = await IntentSimulator.create(BUYER_KEY);
    await duplicate.commitRange(lock);
    await duplicate.commitVerify(hit);
    await expect(duplicate.commitVerify({ ...hit, offerSalt: OTHER_SALT })).rejects.toThrow(/intent already verified/);
  });
});
