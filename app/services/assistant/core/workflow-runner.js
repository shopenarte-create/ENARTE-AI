/**
 * Workflow runner — executes exactly one workflow in isolation.
 * Probes AI Adapter (interface only) then runs the workflow.
 * Decision Engine remains the decision maker; AI signals are never authoritative.
 */

import { EVENT_TYPE, WORKFLOW_STATUS } from "../constants.js";
import { createNotImplementedResult } from "../contracts/index.js";
import { getWorkflow, runWorkflow } from "../workflows/registry.js";
import { publish } from "./event-bus.js";
import { probeAiSignal } from "../utils/ai-signal.js";

const EXECUTABLE = new Set([
  WORKFLOW_STATUS.ACTIVE,
  WORKFLOW_STATUS.PLACEHOLDER,
]);

export async function executeWorkflow(workflowId, ctx, input = {}) {
  const workflow = getWorkflow(workflowId);

  if (!workflow) {
    const result = createNotImplementedResult(
      "workflow",
      workflowId,
      `Workflow "${workflowId}" is not registered.`,
    );
    await publish(EVENT_TYPE.WORKFLOW_SKIPPED, {
      workflowId,
      reason: "not_registered",
    });
    return result;
  }

  await publish(EVENT_TYPE.WORKFLOW_SELECTED, {
    workflowId: workflow.id,
    status: workflow.status,
  });

  const aiSignal = await probeAiSignal(ctx, input, workflow.id);
  const enrichedCtx = {
    ...ctx,
    metadata: Object.freeze({
      ...(ctx?.metadata || {}),
      aiSignal,
    }),
  };

  if (!EXECUTABLE.has(workflow.status)) {
    const result = await runWorkflow(workflow.id, enrichedCtx, input);
    await publish(EVENT_TYPE.WORKFLOW_SKIPPED, {
      workflowId: workflow.id,
      reason: workflow.status,
    });
    return result;
  }

  return runWorkflow(workflow.id, enrichedCtx, input);
}
