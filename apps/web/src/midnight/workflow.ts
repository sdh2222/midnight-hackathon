import {
  ZERO_BYTES_32,
  dateToUnixDay,
  hashToBytes,
  hexToBytes,
  type Offer,
  type PublicRequirement,
} from "@midnight-hackathon/shared";
import { randomBytes32 } from "./encoding";
import type { PrivateIntentVault } from "./private-vault";
import type {
  IntentContractAdapter,
  LockedIntent,
  VerifiedOffer,
  WalletConnection,
} from "./types";

export type LockIntentInput = {
  intentId: string;
  publicRequirement: PublicRequirement;
  priceMaxKrw: bigint;
};

export class ProcurementContractWorkflow {
  constructor(
    private readonly adapter: IntentContractAdapter,
    private readonly vault: PrivateIntentVault,
    private readonly createSalt: () => Uint8Array = randomBytes32,
  ) {}

  get mode(): IntentContractAdapter["mode"] {
    return this.adapter.mode;
  }

  detectWallet(): Promise<boolean> {
    return this.adapter.detectWallet();
  }

  connectWallet(): Promise<WalletConnection> {
    return this.adapter.connectWallet();
  }

  async lockIntent(input: LockIntentInput): Promise<LockedIntent> {
    if (input.priceMaxKrw <= 0n) {
      throw new Error("최대 예산은 0보다 커야 합니다.");
    }

    const intentIdBytes = await hashToBytes(input.intentId);
    const itemId = await hashToBytes(input.publicRequirement.item.trim().toLowerCase());
    const sourceId = ZERO_BYTES_32.slice();
    const dateMax = dateToUnixDay(input.publicRequirement.requiredBy);
    const salt = this.createSalt();
    const transaction = await this.adapter.commitRange({
      intentId: intentIdBytes,
      itemId,
      quantity: BigInt(input.publicRequirement.quantity),
      currency: "KRW",
      version: 1n,
      priceMax: input.priceMaxKrw,
      sourceId,
      dateMax,
      salt,
    });

    const locked: LockedIntent = {
      intentId: input.intentId,
      intentIdBytes,
      publicRequirement: input.publicRequirement,
      priceMax: input.priceMaxKrw,
      sourceId,
      dateMax,
      salt,
      commitRangeTransactionId: transaction.transactionId,
      committedAt: transaction.submittedAt,
    };
    this.vault.put(locked);
    return locked;
  }

  async verifyOffer(intentId: string, offer: Offer): Promise<VerifiedOffer> {
    const locked = this.vault.get(intentId);
    if (!locked) {
      throw new Error("로컬 private intent를 찾지 못했습니다. 검색부터 다시 시작해 주세요.");
    }
    if (BigInt(offer.convertedTotalKrw) > locked.priceMax) {
      throw new Error("선택한 견적이 잠긴 최대 예산을 초과합니다.");
    }
    if (locked.dateMax !== 0n && !offer.deliveryDate) {
      throw new Error("납기일이 없는 견적은 설정한 납기 조건으로 검증할 수 없습니다.");
    }

    const offerSalt = this.createSalt();
    const transaction = await this.adapter.commitVerify({
      intentId: locked.intentIdBytes,
      priceMax: locked.priceMax,
      sourceId: locked.sourceId,
      dateMax: locked.dateMax,
      salt: locked.salt,
      offerPrice: BigInt(offer.convertedTotalKrw),
      offerSource: hexToBytes(offer.sourceId),
      offerDate: dateToUnixDay(offer.deliveryDate),
      offerSalt,
    });

    return {
      offer,
      offerSalt,
      commitVerifyTransactionId: transaction.transactionId,
      verifiedAt: transaction.submittedAt,
    };
  }
}
