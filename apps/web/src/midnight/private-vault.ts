import type { LockedIntent } from "./types";

export interface PrivateIntentVault {
  put(intent: LockedIntent): void;
  get(intentId: string): LockedIntent | undefined;
  remove(intentId: string): void;
  clear(): void;
}

export class InMemoryPrivateIntentVault implements PrivateIntentVault {
  private readonly intents = new Map<string, LockedIntent>();

  put(intent: LockedIntent): void {
    this.intents.set(intent.intentId, intent);
  }

  get(intentId: string): LockedIntent | undefined {
    return this.intents.get(intentId);
  }

  remove(intentId: string): void {
    this.intents.delete(intentId);
  }

  clear(): void {
    this.intents.clear();
  }
}
