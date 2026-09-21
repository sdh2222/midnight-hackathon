import {
  type ChargedState,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Currency, type Ledger, ledger, pureCircuits } from '../managed/intent/contract/index.js';

export type RangeArgs = {
  intentId: Uint8Array;
  itemId: Uint8Array;
  quantity: bigint;
  currency: Currency;
  version: bigint;
  priceMax: bigint;
  sourceId: Uint8Array;
  dateMax: bigint;
  salt: Uint8Array;
};

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

  as(caller: string): this {
    this.caller = caller;
    return this;
  }

  ledger(): Ledger {
    return ledger(this.state);
  }

  rangeCommitment(priceMax: bigint, sourceId: Uint8Array, dateMax: bigint, salt: Uint8Array): Uint8Array {
    return pureCircuits.rangeCommitment(priceMax, sourceId, dateMax, salt);
  }

  offerCommitment(offerPrice: bigint, offerSource: Uint8Array, offerDate: bigint, offerSalt: Uint8Array): Uint8Array {
    return pureCircuits.offerCommitment(offerPrice, offerSource, offerDate, offerSalt);
  }

  async commitRange(p: RangeArgs): Promise<Ledger> {
    const ctx = createCircuitContext('commitRange', this.address, this.caller, this.state, this.privateState);
    const results = await this.contract.impureCircuits.commitRange(
      ctx, p.intentId, p.itemId, p.quantity, p.currency, p.version, p.priceMax, p.sourceId, p.dateMax, p.salt,
    );
    this.state = results.context.callContext.currentQueryContext.state;
    return this.ledger();
  }
}
