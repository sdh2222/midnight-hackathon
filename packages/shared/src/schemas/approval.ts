import { z } from "zod";
import { Bytes32HexSchema } from "./common.js";

export const ApprovalPayloadSchema = z
  .object({
    approvalId: z.string().uuid(),
    intentId: z.string().trim().min(1).max(128),
    intentIdHash: Bytes32HexSchema,
    offerSnapshotHash: Bytes32HexSchema,
    sourceId: Bytes32HexSchema,
    approvedAt: z.string().datetime({ offset: true }),
    walletAddress: z.string().trim().min(1).max(256),
    termsVersion: z.string().trim().min(1).max(32),
  })
  .strict();

export const ApprovalReceiptSchema = ApprovalPayloadSchema.extend({
  walletSignature: z.string().trim().min(1).max(4096),
}).strict();

export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;
export type ApprovalReceipt = z.infer<typeof ApprovalReceiptSchema>;
