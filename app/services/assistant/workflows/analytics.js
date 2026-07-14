import { createWorkflowStub } from "./_stub.js";

export default createWorkflowStub({
  id: "analytics",
  phase: "phase6",
  intents: ["analytics_ingest"],
  capabilities: ["analytics.track"],
  description: "Analytics ingestion workflow.",
});
