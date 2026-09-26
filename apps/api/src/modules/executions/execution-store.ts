import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ExecutionHistoryListSchema,
  ExecutionHistoryRecordSchema,
  type ExecutionHistoryRecord,
} from "@midnight-hackathon/shared";

export interface ExecutionStore {
  list(accountIdHash: string): Promise<ExecutionHistoryRecord[]>;
  get(executionId: string, accountIdHash: string): Promise<ExecutionHistoryRecord | undefined>;
  create(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord>;
  update(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord>;
}

export class InMemoryExecutionStore implements ExecutionStore {
  private readonly records: ExecutionHistoryRecord[] = [];

  async list(accountIdHash: string): Promise<ExecutionHistoryRecord[]> {
    return this.records
      .filter((record) => record.accountIdHash === accountIdHash)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(
    executionId: string,
    accountIdHash: string,
  ): Promise<ExecutionHistoryRecord | undefined> {
    return this.records.find(
      (record) => record.executionId === executionId && record.accountIdHash === accountIdHash,
    );
  }

  async create(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    const parsed = ExecutionHistoryRecordSchema.parse(record);
    const existing = this.records.find(({ approvalId }) => approvalId === parsed.approvalId);
    if (existing) return existing;
    this.records.push(parsed);
    return parsed;
  }

  async update(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    const parsed = ExecutionHistoryRecordSchema.parse(record);
    const index = this.records.findIndex(
      (candidate) =>
        candidate.executionId === parsed.executionId
        && candidate.accountIdHash === parsed.accountIdHash,
    );
    if (index < 0) throw new Error("execution record not found");
    this.records[index] = parsed;
    return parsed;
  }
}

export class JsonFileExecutionStore implements ExecutionStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async list(accountIdHash: string): Promise<ExecutionHistoryRecord[]> {
    await this.writeQueue;
    const records = await this.readRecords();
    return records
      .filter((record) => record.accountIdHash === accountIdHash)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(
    executionId: string,
    accountIdHash: string,
  ): Promise<ExecutionHistoryRecord | undefined> {
    return (await this.list(accountIdHash)).find((record) => record.executionId === executionId);
  }

  async create(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    const parsed = ExecutionHistoryRecordSchema.parse(record);
    let result = parsed;

    this.writeQueue = this.writeQueue.then(async () => {
      const records = await this.readRecords();
      const existing = records.find(({ approvalId }) => approvalId === parsed.approvalId);
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

  async update(record: ExecutionHistoryRecord): Promise<ExecutionHistoryRecord> {
    const parsed = ExecutionHistoryRecordSchema.parse(record);

    this.writeQueue = this.writeQueue.then(async () => {
      const records = await this.readRecords();
      const index = records.findIndex(
        (candidate) =>
          candidate.executionId === parsed.executionId
          && candidate.accountIdHash === parsed.accountIdHash,
      );
      if (index < 0) throw new Error("execution record not found");
      records[index] = parsed;
      await this.writeRecords(records);
    });

    await this.writeQueue;
    return parsed;
  }

  private async readRecords(): Promise<ExecutionHistoryRecord[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return ExecutionHistoryListSchema.parse(JSON.parse(content));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async writeRecords(records: ExecutionHistoryRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}
