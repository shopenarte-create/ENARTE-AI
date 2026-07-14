import { createAskPhotoWorkflow } from "./_ask-photo.js";

export default createAskPhotoWorkflow({
  id: "room_analysis",
  intents: ["analyze_room"],
  description:
    "Recommend lighting for a room — ask for upload/capture after Smart Action only.",
  photoKind: "room",
});
