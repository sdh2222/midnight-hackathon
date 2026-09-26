import type { JevProvider } from "./jev-provider.js";
import { HttpJevProvider } from "./http-jev.js";
import { MockJevProvider } from "./mock-jev.js";

export type JevEnvironment = Partial<Record<
  | "JEV_PROVIDER"
  | "JEV_API_URL"
  | "JEV_API_KEY"
  | "JEV_MODEL"
  | "JEV_TIMEOUT_MS"
  | "JEV_MAX_RETRIES"
  | "JEV_MIN_CONFIDENCE",
  string
>>;

function optionalNumber(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

export function createJevProvider(
  environment: JevEnvironment,
  fetchImplementation: typeof globalThis.fetch = globalThis.fetch,
): JevProvider {
  const provider = environment.JEV_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider === "mock") {
    return new MockJevProvider();
  }
  if (provider !== "typesafe") {
    throw new Error(`Unsupported JEV_PROVIDER: ${provider}`);
  }

  const apiKey = environment.JEV_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("JEV_API_KEY is required when JEV_PROVIDER=typesafe");
  }

  const timeoutMs = optionalNumber(environment.JEV_TIMEOUT_MS, "JEV_TIMEOUT_MS");
  const maxRetries = optionalNumber(environment.JEV_MAX_RETRIES, "JEV_MAX_RETRIES");
  const minimumConfidence = optionalNumber(
    environment.JEV_MIN_CONFIDENCE,
    "JEV_MIN_CONFIDENCE",
  );
  if (maxRetries !== undefined && !Number.isInteger(maxRetries)) {
    throw new Error("JEV_MAX_RETRIES must be an integer");
  }
  if (minimumConfidence !== undefined && minimumConfidence > 1) {
    throw new Error("JEV_MIN_CONFIDENCE must be between 0 and 1");
  }

  return new HttpJevProvider({
    apiKey,
    fetch: fetchImplementation,
    ...(environment.JEV_API_URL ? { endpoint: environment.JEV_API_URL } : {}),
    ...(environment.JEV_MODEL ? { model: environment.JEV_MODEL } : {}),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(maxRetries === undefined ? {} : { maxRetries }),
    ...(minimumConfidence === undefined ? {} : { minimumConfidence }),
  });
}
