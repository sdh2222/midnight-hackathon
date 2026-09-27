import type { CatalogProvider } from "./catalog-provider.js";
import { MockAlibabaCatalog } from "./mock-catalog.js";
import { ReefAlibabaCatalog } from "./reef-catalog.js";

export type CatalogEnvironment = { CATALOG_PROVIDER?: string; REEF_API_KEY?: string };

export function createCatalogProvider(
  environment: CatalogEnvironment,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): CatalogProvider {
  const provider = environment.CATALOG_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider === "mock") return new MockAlibabaCatalog();
  if (provider === "reef") return new ReefAlibabaCatalog(environment.REEF_API_KEY ?? "", fetchImplementation);
  throw new Error(`Unsupported CATALOG_PROVIDER: ${provider}`);
}
