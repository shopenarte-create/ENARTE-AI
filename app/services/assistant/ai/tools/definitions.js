/**
 * OpenAI Responses API tool definitions mapped to ENARTE capabilities.
 * The model must use these tools for business truth, catalog, and workflows.
 */

export const ASSISTANT_TOOL_NAMES = Object.freeze({
  READ_KNOWLEDGE: "read_knowledge",
  LOOKUP_TAUGHT_ANSWER: "lookup_taught_answer",
  SEARCH_CATALOG: "search_catalog",
  RECOMMEND_PRODUCTS: "recommend_products",
  RUN_WORKFLOW: "run_workflow",
  ROUTE_INTENT: "route_intent",
  LIST_SMART_ACTIONS: "list_smart_actions",
  GET_CONVERSATION_STATE: "get_conversation_state",
});

export const ASSISTANT_RESPONSES_TOOLS = Object.freeze([
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.READ_KNOWLEDGE,
    description:
      "Read ENARTE business truth from the Knowledge Layer (policies, services, personality, delivery). Never invent facts — use this for all business answers.",
    parameters: {
      type: "object",
      properties: {
        moduleId: {
          type: "string",
          description:
            "Knowledge module id, e.g. delivery, services, assistant_personality, business_rules, faq.",
        },
        key: {
          type: "string",
          description: "Optional key within the module.",
        },
      },
      required: ["moduleId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.LOOKUP_TAUGHT_ANSWER,
    description:
      "Look up a human-approved trained answer for this shop. Use FIRST for FAQ-style questions (delivery, warranty, hours, policies, pricing rules). If a match is found, use that answer verbatim — do not invent or rewrite it.",
    parameters: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The customer question to match against trained answers.",
        },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.SEARCH_CATALOG,
    description:
      "REQUIRED for any product, lighting, chandelier, style, color, material, room, or recommendation question. Search the live ENARTE Shopify catalog and return real product cards. Never invent products or answer product questions with generic text alone.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Customer message or search intent." },
        query: { type: "string", description: "Optional explicit search query." },
        category: { type: "string", description: "Optional category filter." },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Optional keyword list.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.RECOMMEND_PRODUCTS,
    description:
      "Recommend similar ENARTE catalog products from a seed product or room context.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        seedProductId: { type: "string" },
        room: { type: "string" },
        category: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.ROUTE_INTENT,
    description:
      "Signal the Decision Engine intent router for a message. Use to choose the right ENARTE workflow before running it.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        intent: { type: "string" },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.RUN_WORKFLOW,
    description:
      "Run a pre-approved ENARTE workflow (delivery, installation, product_search, etc.). Returns factual workflow output — never invent content.",
    parameters: {
      type: "object",
      properties: {
        workflowId: {
          type: "string",
          description:
            "Workflow id: delivery, installation, maintenance, product_search, chandelier, custom_chandeliers, etc.",
        },
        intent: { type: "string" },
        message: { type: "string" },
      },
      required: ["workflowId"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.LIST_SMART_ACTIONS,
    description:
      "List ENARTE smart action buttons the customer can tap (welcome menu or follow-up actions).",
    parameters: {
      type: "object",
      properties: {
        welcomeOnly: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: ASSISTANT_TOOL_NAMES.GET_CONVERSATION_STATE,
    description:
      "Read current conversation memory: phase, slots, selected product, awaiting flags.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
]);
