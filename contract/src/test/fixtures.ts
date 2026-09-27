import { createHash } from 'node:crypto';
import { Currency } from '../managed/intent/contract/index.js';

export const BUYER_KEY = 'aa'.repeat(32);
export const OTHER_KEY = 'cc'.repeat(32);

export const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, 'hex'));

export const id = (s: string): Uint8Array =>
  Uint8Array.from(createHash('sha256').update(s, 'utf8').digest());

export const salt = (n: number): Uint8Array => {
  const out = new Uint8Array(32);
  out[31] = n;
  return out;
};

export const ZERO32 = new Uint8Array(32);

export const ITEM = id('demo-item-1');
export const OTHER_ITEM = id('demo-item-2');
export const BUYER_INTENT = id('intent_buyer_1');
export const OTHER_INTENT = id('intent_other_1');

export const KRW = Currency.KRW;

export const buyerRange = {
  intentId: BUYER_INTENT,
  itemId: ITEM,
  quantity: 1n,
  currency: KRW,
  version: 1n,
};

export const PRICE_MAX = 1_500_000n;
export const OFFER_HIT = 1_200_000n;
export const OFFER_OVER = 1_800_000n;

export const DATE_MAX = 20_000n;
export const OFFER_DATE_OK = 19_000n;
export const OFFER_DATE_LATE = 21_000n;

export const SOURCE_A = id('source-factory-a');
export const SOURCE_B = id('source-factory-b');

export const BUYER_SALT = salt(1);
export const OTHER_SALT = salt(2);
export const OFFER_SALT = salt(3);
