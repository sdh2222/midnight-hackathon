import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  Bytes32HexSchema,
  CreateExecutionHistorySchema,
  SearchRequestSchema,
  ServerWalletSchema,
  sha256Hex,
  type ExecutionHistoryRecord,
} from "@midnight-hackathon/shared";
import type { AuthVerifier } from "./auth/privy-verifier.js";
import type { CatalogProvider } from "./integrations/alibaba/catalog-provider.js";
import {
  createCatalogProvider,
  type CatalogEnvironment,
} from "./integrations/alibaba/create-catalog-provider.js";
import { ReefCatalogError } from "./integrations/alibaba/reef-catalog.js";
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
import { SearchOrchestrator, type PipelineEvent } from "./modules/searches/search-orchestrator.js";
import { deriveMidnightAddress } from "./modules/wallets/derive-address.js";
import { InMemoryWalletStore, type WalletStore } from "./modules/wallets/wallet-store.js";
import { WalletService } from "./modules/wallets/wallet-service.js";

declare module "fastify" {
  interface FastifyRequest {
    authAccountIdHash?: string;
    authPrivyUserId?: string;
  }
}

export type BuildAppOptions = {
  now?: () => string;
  createId?: () => string;
  environment?: JevEnvironment & CatalogEnvironment;
  fetch?: typeof globalThis.fetch;
  catalog?: CatalogProvider;
  authVerifier?: AuthVerifier;
  executionStore?: ExecutionStore;
  orderAdapter?: OrderAdapter;
  executionRetryPolicy?: Partial<ExecutionRetryPolicy>;
  executionWait?: (milliseconds: number) => Promise<void>;
  walletStore?: WalletStore;
  walletEncryptionKey?: string;
  deriveMidnightAddress?: (seedHex: string) => Promise<string>;
  createWalletSeed?: () => string;
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
    catalog: options.catalog ?? createCatalogProvider(
      options.environment ?? process.env,
      options.fetch,
    ),
    jev: createJevProvider(options.environment ?? process.env, options.fetch),
    now,
    createId,
    // Fixed mock FX rate. A real provider must return a rate and timestamp together.
    krwPerCurrencyUnit: 1_350n,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.addHook("onRequest", async (request, reply) => {
    if (!options.authVerifier || !request.url.startsWith("/v1/")) return;
    const match = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? "");
    if (!match?.[1]) {
      return reply.code(401).send({ error: "authentication_required" });
    }
    try {
      const privyUserId = await options.authVerifier(match[1]);
      request.authPrivyUserId = privyUserId;
      request.authAccountIdHash = await sha256Hex(`privy:${privyUserId}`);
    } catch {
      return reply.code(401).send({ error: "invalid_access_token" });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof JevProviderError) {
      return reply.code(502).send({
        error: "jev_provider_error",
        message: "Jev could not evaluate the search request",
      });
    }
    if (error instanceof ReefCatalogError) {
      return reply.code(502).send({ error: error.code, message: error.message });
    }
    return reply.send(error);
  });

  const walletService = options.walletEncryptionKey
    ? WalletService.fromKey(
      options.walletStore ?? new InMemoryWalletStore(),
      options.walletEncryptionKey,
      options.deriveMidnightAddress ?? deriveMidnightAddress,
      options.createWalletSeed,
    )
    : undefined;

  app.get("/v1/wallet", async (request, reply) => {
    if (!request.authPrivyUserId) {
      return reply.code(401).send({ error: "authentication_required" });
    }
    if (!walletService) {
      return reply.code(500).send({ error: "wallet_not_configured" });
    }
    const wallet = ServerWalletSchema.parse(await walletService.ensure(request.authPrivyUserId));
    return reply.code(200).send(wallet);
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

  app.post("/v1/pipeline", async (request, reply) => {
    const body = request.body as { disclosedBudgetKrw?: string };
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_search_request" });
    }
    const disclosed = typeof body.disclosedBudgetKrw === "string" ? body.disclosedBudgetKrw : undefined;
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    });
    const send = (event: PipelineEvent) => {
      reply.raw.write(`${JSON.stringify(event)}\n`);
    };
    try {
      await orchestrator.runPipeline({ ...parsed.data, ...(disclosed ? { disclosedBudgetKrw: disclosed } : {}) }, send);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The pipeline failed.";
      send({ type: "error", message });
    } finally {
      reply.raw.end();
    }
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

    if (request.authAccountIdHash && parsed.data.accountIdHash !== request.authAccountIdHash) {
      return reply.code(403).send({ error: "account_mismatch" });
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
    if (request.authAccountIdHash && parsedAccount.data !== request.authAccountIdHash) {
      return reply.code(403).send({ error: "account_mismatch" });
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
    if (request.authAccountIdHash && parsedAccount.data !== request.authAccountIdHash) {
      return reply.code(403).send({ error: "account_mismatch" });
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
    if (request.authAccountIdHash && parsedAccount.data !== request.authAccountIdHash) {
      return reply.code(403).send({ error: "account_mismatch" });
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
    if (request.authAccountIdHash && parsedAccount.data !== request.authAccountIdHash) {
      return reply.code(403).send({ error: "account_mismatch" });
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
