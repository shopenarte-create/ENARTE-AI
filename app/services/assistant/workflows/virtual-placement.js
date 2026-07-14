import { createMvpDisabledWorkflow } from "./_mvp-disabled.js";

export default createMvpDisabledWorkflow({
  id: "virtual_placement",
  intents: ["place_chandelier", "try_in_room"],
  description: "Virtual placement — disabled for Sprint 4 MVP.",
  capabilityKey: "virtualPlacementDisabled",
});
