import { createCategoryJourneyWorkflow } from "./_category-journey.js";

/**
 * Chandelier journey — shared category pattern (Sprint 7 refactor).
 */
export default createCategoryJourneyWorkflow({
  id: "chandelier",
  intents: ["buy_chandelier", "chandelier", "chandeliers"],
  description:
    "Chandelier purchase journey: one room clarification, then ENARTE product search / sourcing.",
  clarifyMessageKey: "chandelierRoomClarify",
  category: "chandeliers",
  keywords: Object.freeze(["chandelier", "ثريا"]),
  searchPrefix: "chandelier ثريا",
  slotArtifactKey: "room",
});
