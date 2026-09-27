import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

const StoredWalletSchema = z
  .object({
    privyUserId: z.string().trim().min(1),
    midnightAddress: z.string().trim().min(1),
    ciphertext: z.string().trim().min(1),
    iv: z.string().trim().min(1),
    authTag: z.string().trim().min(1),
  })
  .strict();

const StoredWalletListSchema = z.array(StoredWalletSchema);

export type StoredWallet = z.infer<typeof StoredWalletSchema>;

export interface WalletStore {
  get(privyUserId: string): Promise<StoredWallet | undefined>;
  create(record: StoredWallet): Promise<StoredWallet>;
}

export class InMemoryWalletStore implements WalletStore {
  private readonly records: StoredWallet[] = [];

  async get(privyUserId: string): Promise<StoredWallet | undefined> {
    return this.records.find((record) => record.privyUserId === privyUserId);
  }

  async create(record: StoredWallet): Promise<StoredWallet> {
    const parsed = StoredWalletSchema.parse(record);
    const existing = await this.get(parsed.privyUserId);
    if (existing) return existing;
    this.records.push(parsed);
    return parsed;
  }
}

export class JsonFileWalletStore implements WalletStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async get(privyUserId: string): Promise<StoredWallet | undefined> {
    await this.writeQueue;
    return (await this.readRecords()).find((record) => record.privyUserId === privyUserId);
  }

  async create(record: StoredWallet): Promise<StoredWallet> {
    const parsed = StoredWalletSchema.parse(record);
    let result = parsed;
    this.writeQueue = this.writeQueue.then(async () => {
      const records = await this.readRecords();
      const existing = records.find((candidate) => candidate.privyUserId === parsed.privyUserId);
      if (existing) {
        result = existing;
        return;
      }
      records.push(parsed);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    });
    await this.writeQueue;
    return result;
  }

  private async readRecords(): Promise<StoredWallet[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return StoredWalletListSchema.parse(JSON.parse(content));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }
}
