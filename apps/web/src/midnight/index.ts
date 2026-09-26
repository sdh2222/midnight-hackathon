import { DemoIntentContractAdapter } from "./demo-adapter";
import { LaceIntentContractAdapter } from "./lace-adapter";
import { InMemoryPrivateIntentVault } from "./private-vault";
import { ProcurementContractWorkflow } from "./workflow";

export function createProcurementContractWorkflow(): ProcurementContractWorkflow {
  const mode = import.meta.env.VITE_MIDNIGHT_MODE ?? "demo";
  const adapter = mode === "lace"
    ? new LaceIntentContractAdapter()
    : new DemoIntentContractAdapter();
  return new ProcurementContractWorkflow(adapter, new InMemoryPrivateIntentVault());
}

export * from "./types";
export * from "./workflow";
