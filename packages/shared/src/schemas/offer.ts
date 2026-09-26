import { z } from "zod";
import {
  Bytes32HexSchema,
  CurrencyCodeSchema,
  DateOnlySchema,
  NonNegativeIntegerStringSchema,
  PositiveDecimalStringSchema,
  PositiveIntegerStringSchema,
  UINT32_MAX,
} from "./common.js";

export const OfferProviderSchema = z.enum(["alibaba", "mock"]);

export const OfferSchema = z
  .object({
    offerId: z.string().trim().min(1).max(128),
    provider: OfferProviderSchema,
    providerListingId: z.string().trim().min(1).max(256),
    sourceId: Bytes32HexSchema,
    supplierId: z.string().trim().min(1).max(256),
    title: z.string().trim().min(1).max(500),
    variant: z.string().trim().min(1).max(300).optional(),
    quantity: z.number().int().positive().max(UINT32_MAX),
    unit: z.string().trim().min(1).max(32),
    minimumOrderQuantity: z.number().int().positive().max(UINT32_MAX).optional(),
    originalCurrency: CurrencyCodeSchema,
    originalUnitPrice: PositiveDecimalStringSchema,
    convertedTotalKrw: PositiveIntegerStringSchema,
    shippingCostKrw: NonNegativeIntegerStringSchema.optional(),
    exchangeRateTimestamp: z.string().datetime({ offset: true }).optional(),
    leadTimeDays: z.number().int().nonnegative().max(UINT32_MAX).optional(),
    deliveryDate: DateOnlySchema.optional(),
    incoterm: z.string().trim().min(1).max(32).optional(),
    sourceUrl: z.string().url(),
    fetchedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    rawPayloadHash: Bytes32HexSchema,
  })
  .strict();

export const RankedOfferSchema = z
  .object({
    offer: OfferSchema,
    relevanceScore: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
    needsReview: z.boolean(),
  })
  .strict();

export type OfferProvider = z.infer<typeof OfferProviderSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type RankedOffer = z.infer<typeof RankedOfferSchema>;
