import { z } from "zod";
import { Bytes32HexSchema } from "./common.js";

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
