/**
 * Extension ports — stable connection points for future modules
 * (admin AI, sourcing AI, analytics, etc.) without changing assistant core.
 *
 * External modules register here; the orchestrator / event bus can notify them.
 */

import { MODULE_STATUS } from "../constants.js";
import { defineExtensionPort } from "../contracts/index.js";
import { subscribe, publish } from "../core/event-bus.js";
import { EVENT_TYPE } from "../constants.js";

/** @type {Map<string, object>} */
const ports = new Map();

/** @type {Map<string, object>} */
const connectedModules = new Map();

export function registerPort(definition) {
  const port = defineExtensionPort(definition);
  ports.set(port.id, port);
  return port;
}

export function listPorts() {
  return [...ports.values()];
}

export function getPort(id) {
  return ports.get(id) || null;
}

/**
 * Connect an external module to a named port.
 * Module shape: { id, onEvent?: fn, api?: object }
 */
export function connectModule(portId, module) {
  const port = ports.get(portId);
  if (!port) {
    return Object.freeze({
      ok: false,
      error: "port_not_found",
      portId,
    });
  }
  if (!module?.id) {
    return Object.freeze({
      ok: false,
      error: "module_id_required",
    });
  }

  const connection = Object.freeze({
    portId,
    moduleId: module.id,
    connectedAt: new Date().toISOString(),
    api: module.api || null,
  });

  connectedModules.set(`${portId}::${module.id}`, connection);

  let unsubscribe = null;
  if (typeof module.onEvent === "function") {
    unsubscribe = subscribe("*", (event) => module.onEvent(event, connection));
  }

  publish(EVENT_TYPE.MODULE_HOOK, {
    action: "connected",
    portId,
    moduleId: module.id,
  }).catch(() => {});

  return Object.freeze({
    ok: true,
    connection,
    unsubscribe,
  });
}

export function listConnectedModules() {
  return [...connectedModules.values()];
}

function registerFoundationPorts() {
  const definitions = [
    {
      id: "port.analytics",
      description: "Analytics dashboard / metrics collectors.",
      attachesTo: ["core.event-bus", "capability.analytics.track"],
    },
    {
      id: "port.admin_ai",
      description: "Internal admin AI module.",
      attachesTo: ["core.orchestrator", "workflows.admin_notifications"],
    },
    {
      id: "port.sourcing_ai",
      description: "Product sourcing AI module.",
      attachesTo: ["workflows.product_sourcing"],
    },
    {
      id: "port.learning",
      description: "Conversation learning / feedback module.",
      attachesTo: ["workflows.conversation_learning", "core.event-bus"],
    },
    {
      id: "port.notifications",
      description: "Admin / ops notification delivery module.",
      attachesTo: ["capability.notify.admin"],
    },
    {
      id: "port.try_in_room",
      description:
        "Optional bridge to existing try-in-room services (never imports storefront UI).",
      attachesTo: ["workflows.room_analysis", "workflows.virtual_placement"],
    },
  ];

  for (const item of definitions) {
    if (ports.has(item.id)) continue;
    registerPort({
      id: item.id,
      status: MODULE_STATUS.PLANNED,
      description: item.description,
      attachesTo: item.attachesTo,
    });
  }
}

registerFoundationPorts();
