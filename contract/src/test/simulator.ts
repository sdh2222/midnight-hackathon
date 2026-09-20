import {
  type ChargedState,
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger, pureCircuits } from '../managed/intent/contract/index.js';

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
}
