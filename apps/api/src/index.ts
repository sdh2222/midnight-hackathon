import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { createPrivyVerifier } from "./auth/privy-verifier.js";
import { createOrderAdapter } from "./integrations/orders/create-order-adapter.js";
import { JsonFileExecutionStore } from "./modules/executions/execution-store.js";
import { JsonFileWalletStore } from "./modules/wallets/wallet-store.js";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
const executionStorePath = process.env.EXECUTION_STORE_PATH
  ?? fileURLToPath(new URL("../data/executions.json", import.meta.url));
const privyAppId = process.env.PRIVY_APP_ID?.trim();
if (!privyAppId) {
  throw new Error("PRIVY_APP_ID is required for the API");
}
const walletEncryptionKey = process.env.WALLET_ENCRYPTION_KEY?.trim();
if (!walletEncryptionKey) {
  throw new Error("WALLET_ENCRYPTION_KEY is required for the API");
}
const walletStorePath = process.env.WALLET_STORE_PATH
  ?? fileURLToPath(new URL("../data/wallets.json", import.meta.url));
const app = buildApp({
  authVerifier: createPrivyVerifier(privyAppId),
  executionStore: new JsonFileExecutionStore(executionStorePath),
  walletStore: new JsonFileWalletStore(walletStorePath),
  walletEncryptionKey,
  orderAdapter: createOrderAdapter(process.env),
  executionRetryPolicy: {
    maxRetries: Number.parseInt(process.env.ORDER_MAX_RETRIES ?? "2", 10),
    baseDelayMs: Number.parseInt(process.env.ORDER_RETRY_BASE_MS ?? "100", 10),
  },
});

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
