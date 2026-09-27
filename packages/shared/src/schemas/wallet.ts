import { z } from "zod";

export const ServerWalletSchema = z
  .object({
    midnightAddress: z.string().trim().min(1).max(256),
    created: z.boolean(),
  })
  .strict();

export type ServerWallet = z.infer<typeof ServerWalletSchema>;
