import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  Bytes32HexSchema,
  CreateExecutionHistorySchema,
  SearchRequestSchema,
  type ExecutionHistoryRecord,
} from "@midnight-hackathon/shared";
import { MockAlibabaCatalog } from "./integrations/alibaba/mock-catalog.js";
import {
  createJevProvider,
  type JevEnvironment,
} from "./integrations/jev/create-jev-provider.js";
import { JevProviderError } from "./integrations/jev/http-jev.js";
import type { OrderAdapter } from "./integrations/orders/order-adapter.js";
import { MockOrderAdapter } from "./integrations/orders/mock-order-adapter.js";
import {
  ExecutionService,
  type ExecutionRetryPolicy,
} from "./modules/executions/execution-service.js";
import {
  InMemoryExecutionStore,
  type ExecutionStore,
} from "./modules/executions/execution-store.js";
import { SearchOrchestrator } from "./modules/searches/search-orchestrator.js";

export type BuildAppOptions = {
  now?: () => string;
  createId?: () => string;
  environment?: JevEnvironment;
  fetch?: typeof globalThis.fetch;
  executionStore?: ExecutionStore;
  orderAdapter?: OrderAdapter;
  executionRetryPolicy?: Partial<ExecutionRetryPolicy>;
  executionWait?: (milliseconds: number) => Promise<void>;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? randomUUID;
  const executionStore = options.executionStore ?? new InMemoryExecutionStore();
  const executionService = new ExecutionService({
    store: executionStore,
    adapter: options.orderAdapter ?? new MockOrderAdapter(),
    now,
    ...(options.executionRetryPolicy
      ? { retryPolicy: options.executionRetryPolicy }
      : {}),
    ...(options.executionWait ? { wait: options.executionWait } : {}),
  });
  const orchestrator = new SearchOrchestrator({
    catalog: new MockAlibabaCatalog(),
    jev: createJevProvider(options.environment ?? process.env, options.fetch),
    now,
    createId,
    // Fixed mock FX rate. A real provider must return a rate and timestamp together.
    krwPerCurrencyUnit: 1_350n,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof JevProviderError) {
      return reply.code(502).send({
        error: "jev_provider_error",
        message: "Jev could not evaluate the search request",
      });
    }
    return reply.send(error);
  });

  app.post("/v1/searches", async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_search_request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const result = await orchestrator.search(parsed.data);
    return reply.code(200).send(result);
  });

  app.post("/v1/executions", async (request, reply) => {
    const parsed = CreateExecutionHistorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_execution_history",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const timestamp = now();
    const record: ExecutionHistoryRecord = {
      ...parsed.data,
      executionId: createId(),
      status: "verified",
      attemptCount: 0,
      events: [{
        status: "verified",
        occurredAt: parsed.data.approvedAt,
        note: "Midnight commitVerify completed",
      }],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return reply.code(201).send(await executionService.createAndExecute(record));
  });

  app.get("/v1/executions", async (request, reply) => {
    const { accountIdHash } = request.query as { accountIdHash?: unknown };
    const parsedAccount = Bytes32HexSchema.safeParse(accountIdHash);
    if (!parsedAccount.success) {
      return reply.code(400).send({ error: "invalid_account_id_hash" });
    }
    return executionStore.list(parsedAccount.data);
  });

  app.get("/v1/executions/:executionId", async (request, reply) => {
    const { executionId } = request.params as { executionId?: unknown };
    const { accountIdHash } = request.query as { accountIdHash?: unknown };
    const parsedAccount = Bytes32HexSchema.safeParse(accountIdHash);
    if (typeof executionId !== "string" || !parsedAccount.success) {
      return reply.code(400).send({ error: "invalid_execution_lookup" });
    }
    const record = await executionStore.get(executionId, parsedAccount.data);
    if (!record) return reply.code(404).send({ error: "execution_not_found" });
    return reply.code(200).send(record);
  });

  app.post("/v1/executions/:executionId/sync", async (request, reply) => {
    const { executionId } = request.params as { executionId?: unknown };
    const { accountIdHash } = request.query as { accountIdHash?: unknown };
    const parsedAccount = Bytes32HexSchema.safeParse(accountIdHash);
    if (typeof executionId !== "string" || !parsedAccount.success) {
      return reply.code(400).send({ error: "invalid_execution_lookup" });
    }
    const record = await executionService.sync(executionId, parsedAccount.data);
    if (!record) return reply.code(404).send({ error: "execution_not_found" });
    return reply.code(200).send(record);
  });

  app.post("/v1/executions/:executionId/retry", async (request, reply) => {
    const { executionId } = request.params as { executionId?: unknown };
    const { accountIdHash } = request.query as { accountIdHash?: unknown };
    const parsedAccount = Bytes32HexSchema.safeParse(accountIdHash);
    if (typeof executionId !== "string" || !parsedAccount.success) {
      return reply.code(400).send({ error: "invalid_execution_lookup" });
    }
    try {
      const record = await executionService.retry(executionId, parsedAccount.data);
      if (!record) return reply.code(404).send({ error: "execution_not_found" });
      return reply.code(200).send(record);
    } catch (error) {
      return reply.code(409).send({
        error: "execution_not_retryable",
        message: error instanceof Error ? error.message : "Execution cannot be retried",
      });
    }
  });

  return app;
}
