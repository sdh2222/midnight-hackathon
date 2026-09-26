import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { Contract } from "./managed/intent/contract/index.js";

export * as IntentContract from "./managed/intent/contract/index.js";
export { Currency, OfferStatus, ledger } from "./managed/intent/contract/index.js";

export type IntentPrivateState = undefined;
export type IntentCircuitKeys = "commitRange" | "commitVerify";

export const CompiledIntentContract = CompiledContract.make("intent", Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets("./src/managed/intent"),
);
