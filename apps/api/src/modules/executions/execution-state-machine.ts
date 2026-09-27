import {
  ExecutionHistoryRecordSchema,
  type ExecutionHistoryRecord,
  type ExecutionStatus,
} from "@midnight-hackathon/shared";

const allowedTransitions: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  deal_approved: ["verifying", "cancelled"],
  verifying: ["verified", "failed"],
  verified: ["executing", "cancelled"],
  executing: ["order_submitted", "counterparty_accepted", "failed"],
  retrying: ["executing", "cancelled"],
  order_submitted: ["counterparty_accepted", "settled", "failed", "cancelled"],
  counterparty_accepted: ["settled", "failed", "cancelled"],
  settled: [],
  failed: ["retrying", "cancelled"],
  cancelled: [],
};

export type TransitionOptions = {
  note?: string;
  providerOrderId?: string;
  failureCode?: string;
  incrementAttempt?: boolean;
  lastSyncedAt?: string;
};

export function canTransition(from: ExecutionStatus, to: ExecutionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionExecution(
  record: ExecutionHistoryRecord,
  status: ExecutionStatus,
  occurredAt: string,
  options: TransitionOptions = {},
): ExecutionHistoryRecord {
  if (!canTransition(record.status, status)) {
    throw new Error(`invalid execution transition: ${record.status} -> ${status}`);
  }

  const next: ExecutionHistoryRecord = {
    ...record,
    status,
    attemptCount: record.attemptCount + (options.incrementAttempt ? 1 : 0),
    events: [
      ...record.events,
      {
        status,
        occurredAt,
        ...(options.note ? { note: options.note } : {}),
      },
    ],
    updatedAt: occurredAt,
    ...(options.providerOrderId ? { providerOrderId: options.providerOrderId } : {}),
    ...(options.lastSyncedAt ? { lastSyncedAt: options.lastSyncedAt } : {}),
  };

  if (status === "failed" && options.failureCode) {
    next.failureCode = options.failureCode;
  } else {
    delete next.failureCode;
  }

  return ExecutionHistoryRecordSchema.parse(next);
}

export function markExecutionSynced(
  record: ExecutionHistoryRecord,
  syncedAt: string,
): ExecutionHistoryRecord {
  return ExecutionHistoryRecordSchema.parse({
    ...record,
    lastSyncedAt: syncedAt,
    updatedAt: syncedAt,
  });
}
