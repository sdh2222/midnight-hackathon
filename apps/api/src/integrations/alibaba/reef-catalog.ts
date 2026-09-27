import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { PublicRequirement, SearchPlan } from "@midnight-hackathon/shared";
import type { CatalogProvider, RawCatalogListing } from "./catalog-provider.js";

const ReefRowSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
  title: z.string(),
  url: z.string().url(),
  price: z.object({
    currency: z.string().optional(),
    max: z.number().finite().positive(),
  }).nullable(),
  moq: z.object({
    quantity: z.number().finite().positive(),
    unit: z.string(),
  }),
  supplier: z.object({
    company_id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    country: z.string().optional(),
  }),
  certifications: z.array(z.string()).optional(),
}).passthrough();

const ReefResponseSchema = z.object({
  ok: z.boolean(),
  data: z.object({ results: z.array(z.unknown()) }).optional(),
  error: z.object({ code: z.string().optional(), message: z.string().optional() }).nullable().optional(),
}).passthrough();

function normalizedUnit(value: string): string {
  const unit = value.trim().toLowerCase();
  return ({ pieces: "piece", pairs: "pair", meters: "meter", sets: "set", bags: "bag",
    kilogram: "kg", kilograms: "kg", boxes: "box" } as Record<string, string>)[unit] ?? unit;
}

function upperPriceMinor(value: number): string {
  const decimal = value.toString();
  const [whole, fraction = ""] = decimal.split(".");
  if (!whole || !/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) {
    throw new Error("Invalid catalog price");
  }
  const cents = BigInt(whole) * 100n
    + BigInt((fraction + "00").slice(0, 2))
    + (fraction.slice(2).replace(/0/g, "") ? 1n : 0n);
  return cents.toString();
}

const localReefKeyFile = fileURLToPath(new URL("../../../../web/.local/reef-key", import.meta.url));

export function localReefKey(): string | undefined {
  if (!existsSync(localReefKeyFile)) return undefined;
  const stored = readFileSync(localReefKeyFile, "utf8").trim();
  return stored.length > 0 ? stored : undefined;
}

export class ReefCatalogError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ReefCatalogError";
  }
}

export class ReefAlibabaCatalog implements CatalogProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
    private readonly endpoint = "https://api.reefapi.com/alibaba/v1/search",
  ) {
    if (!apiKey.trim()) throw new Error("REEF_API_KEY is required when CATALOG_PROVIDER=reef");
  }

  async search(plan: SearchPlan, requirement: PublicRequirement): Promise<RawCatalogListing[]> {
    let response: Response;
    try {
      response = await this.fetchImplementation(this.endpoint, {
        method: "POST",
        headers: { "x-api-key": localReefKey() ?? this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          query: plan.query,
          page: 1,
          sort: "relevance",
          ...(plan.country === "ALL" ? {} : { supplier_country: plan.country }),
          max_order: requirement.quantity,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ReefCatalogError("Alibaba 상품 검색 서비스에 연결하지 못했습니다.", "REEF_UNAVAILABLE");
    }

    let payload: z.infer<typeof ReefResponseSchema>;
    try {
      payload = ReefResponseSchema.parse(await response.json());
    } catch {
      throw new ReefCatalogError("Alibaba 상품 검색 응답을 읽지 못했습니다.", "REEF_INVALID_RESPONSE");
    }
    if (!response.ok || !payload.ok || !payload.data) {
      throw new ReefCatalogError(
        payload.error?.message ?? "Alibaba 상품 검색에 실패했습니다.",
        payload.error?.code ?? `REEF_HTTP_${response.status}`,
      );
    }

    return payload.data.results.flatMap((candidate): RawCatalogListing[] => {
      const parsed = ReefRowSchema.safeParse(candidate);
      if (!parsed.success) return [];
      const row = parsed.data;
      if (row.price === null || row.price.currency !== "USD") return [];
      if (normalizedUnit(row.moq.unit) !== normalizedUnit(requirement.unit)) return [];
      if (!row.url.startsWith("https://www.alibaba.com/")) return [];
      const supplierId = row.supplier.company_id?.toString() ?? row.supplier.name;
      if (!supplierId) return [];
      return [{
        listingId: row.product_id.toString(),
        supplierId,
        ...(row.supplier.name ? { supplierName: row.supplier.name } : {}),
        supplierCountry: row.supplier.country ?? "CN",
        title: row.title,
        tags: row.certifications ?? [],
        minimumOrderQuantity: Math.ceil(row.moq.quantity),
        unit: normalizedUnit(row.moq.unit),
        currency: "USD",
        unitPriceMinor: upperPriceMinor(row.price.max),
        pricingBasis: "catalog_estimate",
        productUrl: row.url,
      }];
    }).slice(0, 12);
  }
}
