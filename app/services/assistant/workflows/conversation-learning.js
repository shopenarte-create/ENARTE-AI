import { createWorkflowStub } from "./_stub.js";

export default createWorkflowStub({
  id: "conversation_learning",
  phase: "phase6",
  intents: ["learn_from_conversation"],
  capabilities: ["learning.record", "analytics.track"],
  description: "Learning-from-conversations workflow.",
});
