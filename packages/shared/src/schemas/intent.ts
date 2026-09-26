import { z } from "zod";
import {
  Bytes32HexSchema,
  CountryCodeSchema,
  DateOnlySchema,
  UINT32_MAX,
  UINT64_MAX,
} from "./common.js";

export const PublicRequirementSchema = z
  .object({
    item: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive().max(UINT32_MAX),
    unit: z.string().trim().min(1).max(32),
    destinationCountry: CountryCodeSchema,
    keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
    requiredBy: DateOnlySchema.optional(),
  })
  .strict();

export const PrivateCriteriaSchema = z
  .object({
    priceMaxKrw: z
      .bigint()
      .positive()
      .refine((value) => value <= UINT64_MAX, "priceMaxKrw exceeds Uint<64>"),
    sourceConstraintId: Bytes32HexSchema.optional(),
    dateMax: z.number().int().nonnegative().max(UINT32_MAX).optional(),
    salt: z
      .instanceof(Uint8Array)
      .refine((value) => value.byteLength === 32, "salt must be exactly 32 bytes"),
  })
  .strict();

export const IntentSplitSchema = z
  .object({
    publicRequirement: PublicRequirementSchema,
    privateCriteria: PrivateCriteriaSchema,
  })
  .strict();

export type PublicRequirement = z.infer<typeof PublicRequirementSchema>;
export type PrivateCriteria = z.infer<typeof PrivateCriteriaSchema>;
export type IntentSplit = z.infer<typeof IntentSplitSchema>;
