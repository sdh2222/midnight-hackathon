import type { Offer, PublicRequirement } from "@midnight-hackathon/shared";

export type WalletConnection = {
  walletName: string;
  address: string;
  networkId: string;
  mode: "demo" | "lace";
};

export type CommitRangeInput = {
  intentId: Uint8Array;
  itemId: Uint8Array;
  quantity: bigint;
  currency: "KRW";
  version: bigint;
  priceMax: bigint;
  sourceId: Uint8Array;
  dateMax: bigint;
  salt: Uint8Array;
};

export type CommitVerifyInput = {
  intentId: Uint8Array;
  priceMax: bigint;
  sourceId: Uint8Array;
  dateMax: bigint;
  salt: Uint8Array;
  offerPrice: bigint;
  offerSource: Uint8Array;
  offerDate: bigint;
  offerSalt: Uint8Array;
};

export type ContractTransaction = {
  transactionId: string;
  submittedAt: string;
};

export interface IntentContractAdapter {
  readonly mode: "demo" | "lace";
  detectWallet(): Promise<boolean>;
  connectWallet(): Promise<WalletConnection>;
  commitRange(input: CommitRangeInput): Promise<ContractTransaction>;
  commitVerify(input: CommitVerifyInput): Promise<ContractTransaction>;
}

export type LockedIntent = {
  intentId: string;
  intentIdBytes: Uint8Array;
  publicRequirement: PublicRequirement;
  priceMax: bigint;
  sourceId: Uint8Array;
  dateMax: bigint;
  salt: Uint8Array;
  commitRangeTransactionId: string;
  committedAt: string;
};

export type VerifiedOffer = {
  offer: Offer;
  offerSalt: Uint8Array;
  commitVerifyTransactionId: string;
  verifiedAt: string;
};
