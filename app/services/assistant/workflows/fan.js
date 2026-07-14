import { createCategoryJourneyWorkflow } from "./_category-journey.js";

export default createCategoryJourneyWorkflow({
  id: "fan",
  intents: ["buy_fan", "fan", "fans"],
  description: "Fan purchase journey: one room clarify → ENARTE product search.",
  clarifyMessageKey: "fanRoomClarify",
  category: "fans",
  keywords: Object.freeze(["fan", "مروحة", "مراوح"]),
  searchPrefix: "fan مروحة",
  slotArtifactKey: "room",
});
