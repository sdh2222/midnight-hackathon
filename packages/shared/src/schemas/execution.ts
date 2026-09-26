import { z } from "zod";
import { Bytes32HexSchema } from "./common.js";
import { PublicRequirementSchema } from "./intent.js";
import { OfferSchema } from "./offer.js";

export const ExecutionStatusSchema = z.enum([
  "deal_approved",
  "verifying",
  "verified",
  "executing",
  "order_submitted",
  "counterparty_accepted",
  "settled",
  "failed",
  "cancelled",
]);

export const ExecutionRecordSchema = z
  .object({
    executionId: z.string().uuid(),
    approvalId: z.string().uuid(),
    intentId: z.string().trim().min(1).max(128),
    intentIdHash: Bytes32HexSchema,
    offerSnapshotHash: Bytes32HexSchema,
    status: ExecutionStatusSchema,
    midnightTransactionId: z.string().trim().min(1).max(256).optional(),
    providerOrderId: z.string().trim().min(1).max(256).optional(),
    failureCode: z.string().trim().min(1).max(128).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type ExecutionRecord = z.infer<typeof ExecutionRecordSchema>;

export const ExecutionEventSchema = z
  .object({
    status: ExecutionStatusSchema,
    occurredAt: z.string().datetime({ offset: true }),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const CreateExecutionHistorySchema = z
  .object({
    approvalId: z.string().uuid(),
    accountIdHash: Bytes32HexSchema,
    intentId: z.string().trim().min(1).max(128),
    publicRequirement: PublicRequirementSchema,
    offer: OfferSchema,
    offerSnapshotHash: Bytes32HexSchema,
    commitRangeTransactionId: z.string().trim().min(1).max(256),
    commitVerifyTransactionId: z.string().trim().min(1).max(256),
    approvedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const ExecutionHistoryRecordSchema = CreateExecutionHistorySchema.extend({
  executionId: z.string().uuid(),
  status: ExecutionStatusSchema,
  events: z.array(ExecutionEventSchema).min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export const ExecutionHistoryListSchema = z.array(ExecutionHistoryRecordSchema);

export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;
export type CreateExecutionHistory = z.infer<typeof CreateExecutionHistorySchema>;
export type ExecutionHistoryRecord = z.infer<typeof ExecutionHistoryRecordSchema>;
