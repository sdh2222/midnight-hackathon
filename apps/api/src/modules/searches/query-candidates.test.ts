import { describe, expect, it } from "vitest";
import { PublicRequirementSchema } from "@midnight-hackathon/shared";
import { MockAlibabaCatalog } from "../../integrations/alibaba/mock-catalog.js";
import { MockJevProvider } from "../../integrations/jev/mock-jev.js";
import { SearchOrchestrator, queryCandidates } from "./search-orchestrator.js";

describe("query pipeline", () => {
  it("asks Jev for queries, then ranks each page", async () => {
    const requirement = PublicRequirementSchema.parse({
      item: "Industrial nitrile gloves",
      quantity: 10000,
      unit: "piece",
      destinationCountry: "KR",
      keywords: ["nitrile", "gloves"],
    });
    const events: string[] = [];
    const orchestrator = new SearchOrchestrator({
      catalog: new MockAlibabaCatalog(),
      jev: new MockJevProvider(),
      now: () => "2026-09-27T00:00:00.000Z",
      createId: () => "11111111-1111-4111-8111-111111111111",
      krwPerCurrencyUnit: 1350n,
    });
    await orchestrator.runPipeline({ intentId: "intent-1", publicRequirement: requirement }, (event) => {
      events.push(event.type);
      if (event.type === "queries") expect(event.queries.length).toBeGreaterThan(0);
      if (event.type === "queries") expect(event.queries.length).toBeLessThanOrEqual(5);
      if (event.type === "row") expect(queryCandidates(requirement)).toContain(event.query);
    });
    expect(events[0]).toBe("queries");
    expect(events.at(-1)).toBe("done");
    expect(events.filter((type) => type === "row").length).toBeGreaterThan(0);
  });
});
