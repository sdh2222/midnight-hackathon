import { createHash } from 'node:crypto';
import { Currency, Role } from '../managed/intent/contract/index.js';

// 64-char hex coin public keys. The simulator sets ownPublicKey() from these.
export const BUYER_KEY = 'aa'.repeat(32);
export const SELLER_KEY = 'bb'.repeat(32);
export const OTHER_KEY = 'cc'.repeat(32);

export const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, 'hex'));

// SHA-256 of a JSON string id, as the backend will do it (spec section 5).
export const id = (s: string): Uint8Array =>
  Uint8Array.from(createHash('sha256').update(s, 'utf8').digest());

// Deterministic 32-byte salts for tests. Production uses random bytes.
export const salt = (n: number): Uint8Array => {
  const out = new Uint8Array(32);
  out[31] = n;
  return out;
};

export const ITEM = id('demo-item-1');
export const OTHER_ITEM = id('demo-item-2');
export const BUYER_INTENT = id('intent_buyer_1');
export const SELLER_INTENT = id('intent_seller_1');
export const OTHER_INTENT = id('intent_other_1');

export const KRW = Currency.KRW;

export const buyerRange = {
  intentId: BUYER_INTENT,
  role: Role.Buyer,
  itemId: ITEM,
  quantity: 1n,
  currency: KRW,
  version: 1n,
};

export const sellerRange = {
  intentId: SELLER_INTENT,
  role: Role.Seller,
  itemId: ITEM,
  quantity: 1n,
  currency: KRW,
  version: 1n,
};

// Spec section 13 amounts, in won.
export const BUYER_MAX = 1_000_000n;
export const SELLER_MIN = 800_000n;
export const OFFER_HIT = 900_000n;
export const OFFER_LOW = 750_000n;
export const BUYER_MAX_NO_OVERLAP = 700_000n;
export const OFFER_TOO_HIGH = 850_000n;

export const BUYER_SALT = salt(1);
export const SELLER_SALT = salt(2);
export const OFFER_SALT = salt(3);
