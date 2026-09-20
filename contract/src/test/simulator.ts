import {
  type ChargedState,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Currency, type Ledger, type Role, ledger, pureCircuits } from '../managed/intent/contract/index.js';

export type RangeArgs = {
  intentId: Uint8Array;
  role: Role;
  itemId: Uint8Array;
  quantity: bigint;
  currency: Currency;
  version: bigint;
  limit: bigint;
  salt: Uint8Array;
};

export type OfferArgs = {
  buyerIntentId: Uint8Array;
  sellerIntentId: Uint8Array;
  buyerMax: bigint;
  buyerSalt: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};

export type SellerArgs = {
  pairId: Uint8Array;
  sellerMin: bigint;
  sellerSalt: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};

export type OpenArgs = {
  pairId: Uint8Array;
  offer: bigint;
  offerSalt: Uint8Array;
};

// The contract declares no witnesses; every secret is a circuit argument.
export type IntentPrivateState = Record<string, never>;
export const witnesses = {};

export class IntentSimulator {
  private constructor(
    private readonly contract: Contract<IntentPrivateState>,
    private readonly address: ReturnType<typeof sampleContractAddress>,
    private caller: string,
    private state: ChargedState,
    private privateState: IntentPrivateState,
  ) {}

  static async create(caller: string): Promise<IntentSimulator> {
    const contract = new Contract<IntentPrivateState>(witnesses);
    const { currentContractState, currentPrivateState } = await contract.initialState(
      createConstructorContext({}, caller),
    );
    return new IntentSimulator(
      contract,
      sampleContractAddress(),
      caller,
      currentContractState.data,
      currentPrivateState,
    );
  }

  // Each circuit call builds a fresh context from this.caller, so ownPublicKey() follows the last as().
  as(caller: string): this {
    this.caller = caller;
    return this;
  }

  ledger(): Ledger {
    return ledger(this.state);
  }

  pairIdOf(buyerIntentId: Uint8Array, sellerIntentId: Uint8Array): Uint8Array {
    return pureCircuits.pairIdOf(buyerIntentId, sellerIntentId);
  }

  rangeCommitment(limit: bigint, salt: Uint8Array): Uint8Array {
    return pureCircuits.rangeCommitment(limit, salt);
  }

  offerCommitment(offer: bigint, offerSalt: Uint8Array): Uint8Array {
    return pureCircuits.offerCommitment(offer, offerSalt);
  }

  async commitRange(p: RangeArgs): Promise<Ledger> {
    const ctx = createCircuitContext('commitRange', this.address, this.caller, this.state, this.privateState);
    const results = await this.contract.impureCircuits.commitRange(ctx, p.intentId, p.role, p.itemId, p.quantity, p.currency, p.version, p.limit, p.salt);
    this.state = results.context.callContext.currentQueryContext.state;
    return this.ledger();
  }

  async commitOffer(p: OfferArgs): Promise<Ledger> {
    const ctx = createCircuitContext('commitOffer', this.address, this.caller, this.state, this.privateState);
    const results = await this.contract.impureCircuits.commitOffer(ctx, p.buyerIntentId, p.sellerIntentId, p.buyerMax, p.buyerSalt, p.offer, p.offerSalt);
    this.state = results.context.callContext.currentQueryContext.state;
    return this.ledger();
  }

  async verifySellerSide(p: SellerArgs): Promise<Ledger> {
    const ctx = createCircuitContext('verifySellerSide', this.address, this.caller, this.state, this.privateState);
    const results = await this.contract.impureCircuits.verifySellerSide(ctx, p.pairId, p.sellerMin, p.sellerSalt, p.offer, p.offerSalt);
    this.state = results.context.callContext.currentQueryContext.state;
    return this.ledger();
  }

  async openOffer(p: OpenArgs): Promise<Ledger> {
    const ctx = createCircuitContext('openOffer', this.address, this.caller, this.state, this.privateState);
    const results = await this.contract.impureCircuits.openOffer(ctx, p.pairId, p.offer, p.offerSalt);
    this.state = results.context.callContext.currentQueryContext.state;
    return this.ledger();
  }
}
