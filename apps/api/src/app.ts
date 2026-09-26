import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { SearchRequestSchema } from "@midnight-hackathon/shared";
import { MockAlibabaCatalog } from "./integrations/alibaba/mock-catalog.js";
import {
  createJevProvider,
  type JevEnvironment,
} from "./integrations/jev/create-jev-provider.js";
import { JevProviderError } from "./integrations/jev/http-jev.js";
import { SearchOrchestrator } from "./modules/searches/search-orchestrator.js";

export type BuildAppOptions = {
  now?: () => string;
  createId?: () => string;
  environment?: JevEnvironment;
  fetch?: typeof globalThis.fetch;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const orchestrator = new SearchOrchestrator({
    catalog: new MockAlibabaCatalog(),
    jev: createJevProvider(options.environment ?? process.env, options.fetch),
    now: options.now ?? (() => new Date().toISOString()),
    createId: options.createId ?? randomUUID,
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

  return app;
}
