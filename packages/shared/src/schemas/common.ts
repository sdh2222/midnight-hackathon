import { z } from "zod";

export const UINT32_MAX = 4_294_967_295;
export const UINT64_MAX = 18_446_744_073_709_551_615n;

export const Bytes32HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected a lowercase 32-byte hex string");

export const CountryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "expected an ISO 3166-1 alpha-2 country code");

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "expected an ISO 4217 currency code");

export const DateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const PositiveDecimalStringSchema = z
  .string()
  .regex(/^(?:0\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/, "expected a positive decimal string");

export const NonNegativeIntegerStringSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)$/, "expected a non-negative integer string");

export const PositiveIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "expected a positive integer string");

export type Bytes32Hex = z.infer<typeof Bytes32HexSchema>;
