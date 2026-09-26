import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { JsonFileExecutionStore } from "./modules/executions/execution-store.js";

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
const app = buildApp({
  executionStore: new JsonFileExecutionStore(executionStorePath),
});

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
