import { canonicalJson, sha256Hex } from "@midnight-hackathon/shared";
import { bytesToHex } from "./encoding";
import type {
  CommitRangeInput,
  CommitVerifyInput,
  ContractTransaction,
  IntentContractAdapter,
  WalletConnection,
} from "./types";

type StoredRange = CommitRangeInput;

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export class DemoIntentContractAdapter implements IntentContractAdapter {
  readonly mode = "demo" as const;
  private connected = false;
  private readonly ranges = new Map<string, StoredRange>();
  private readonly ownerItems = new Set<string>();
  private readonly verifiedIntents = new Set<string>();

  async detectWallet(): Promise<boolean> {
    return true;
  }

  async connectWallet(): Promise<WalletConnection> {
    this.connected = true;
    return {
      walletName: "Sourcenight prover",
      address: "mn_addr_demo_7x4k…p91c",
      networkId: "undeployed",
      mode: "demo",
    };
  }

  async commitRange(input: CommitRangeInput): Promise<ContractTransaction> {
    this.requireConnection();
    const intentId = bytesToHex(input.intentId);
    const itemId = bytesToHex(input.itemId);
    if (input.quantity <= 0n) throw new Error("quantity must be positive");
    if (input.priceMax <= 0n) throw new Error("limit must be positive");
    if (this.ranges.has(intentId)) throw new Error("intent already committed");
    if (this.ownerItems.has(itemId)) throw new Error("owner already has a range for this item");
    this.ranges.set(intentId, input);
    this.ownerItems.add(itemId);
    return this.transaction("commitRange", intentId);
  }

  async commitVerify(input: CommitVerifyInput): Promise<ContractTransaction> {
    this.requireConnection();
    const intentId = bytesToHex(input.intentId);
    const stored = this.ranges.get(intentId);
    if (!stored) throw new Error("range missing");
    if (
      stored.priceMax !== input.priceMax ||
      stored.dateMax !== input.dateMax ||
      !sameBytes(stored.sourceId, input.sourceId) ||
      !sameBytes(stored.salt, input.salt)
    ) {
      throw new Error("range does not open");
    }
    if (input.offerPrice <= 0n) throw new Error("offer must be positive");
    if (input.offerPrice > input.priceMax) throw new Error("offer above buyer limit");
    const unconstrainedSource = input.sourceId.every((value) => value === 0);
    if (!unconstrainedSource && !sameBytes(input.offerSource, input.sourceId)) {
      throw new Error("source mismatch");
    }
    if (input.dateMax !== 0n && input.offerDate > input.dateMax) {
      throw new Error("date after buyer max");
    }
    if (this.verifiedIntents.has(intentId)) throw new Error("intent already verified");
    this.verifiedIntents.add(intentId);
    return this.transaction("commitVerify", intentId);
  }

  private requireConnection(): void {
    if (!this.connected) throw new Error("Connect the wallet first");
  }

  private async transaction(circuit: string, intentId: string): Promise<ContractTransaction> {
    const submittedAt = new Date().toISOString();
    return {
      transactionId: await sha256Hex(canonicalJson({ circuit, intentId, submittedAt })),
      submittedAt,
    };
  }
}
