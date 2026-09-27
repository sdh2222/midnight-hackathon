import { randomBytes } from "node:crypto";
import { openSeed, parseEncryptionKey, sealSeed } from "./wallet-crypto.js";
import type { WalletStore } from "./wallet-store.js";

export type ServerWalletView = {
  midnightAddress: string;
  created: boolean;
};

export class WalletService {
  private readonly inflight = new Map<string, Promise<ServerWalletView>>();

  constructor(
    private readonly store: WalletStore,
    private readonly encryptionKey: Buffer,
    private readonly deriveAddress: (seedHex: string) => Promise<string>,
    private readonly createSeed: () => string = () => randomBytes(32).toString("hex"),
  ) {}

  static fromKey(
    store: WalletStore,
    encryptionKeyHex: string,
    deriveAddress: (seedHex: string) => Promise<string>,
    createSeed?: () => string,
  ): WalletService {
    return new WalletService(
      store,
      parseEncryptionKey(encryptionKeyHex),
      deriveAddress,
      createSeed,
    );
  }

  ensure(privyUserId: string): Promise<ServerWalletView> {
    const pending = this.inflight.get(privyUserId);
    if (pending) return pending;
    const job = this.loadOrCreate(privyUserId).finally(() => {
      this.inflight.delete(privyUserId);
    });
    this.inflight.set(privyUserId, job);
    return job;
  }

  async readSeed(privyUserId: string): Promise<string | undefined> {
    const record = await this.store.get(privyUserId);
    if (!record) return undefined;
    return openSeed(record, this.encryptionKey);
  }

  private async loadOrCreate(privyUserId: string): Promise<ServerWalletView> {
    const existing = await this.store.get(privyUserId);
    if (existing) return { midnightAddress: existing.midnightAddress, created: false };

    const seedHex = this.createSeed();
    const midnightAddress = await this.deriveAddress(seedHex);
    const sealed = sealSeed(seedHex, this.encryptionKey);
    const stored = await this.store.create({
      privyUserId,
      midnightAddress,
      ...sealed,
    });
    return {
      midnightAddress: stored.midnightAddress,
      created: stored.ciphertext === sealed.ciphertext,
    };
  }
}
