import { createCategoryJourneyWorkflow } from "./_category-journey.js";

export default createCategoryJourneyWorkflow({
  id: "outdoor_lighting",
  intents: ["buy_outdoor", "outdoor_lighting", "outdoor"],
  description:
    "Outdoor lighting journey: one space clarify → ENARTE product search.",
  clarifyMessageKey: "outdoorSpaceClarify",
  category: "outdoor",
  keywords: Object.freeze(["outdoor", "خارجية", "garden", "garage"]),
  searchPrefix: "outdoor إضاءة خارجية",
  slotArtifactKey: "room",
});
