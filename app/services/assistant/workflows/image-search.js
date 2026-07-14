import { createAskPhotoWorkflow } from "./_ask-photo.js";

export default createAskPhotoWorkflow({
  id: "image_search",
  intents: ["search_by_image"],
  description:
    "Search by image — ask for a product photo; never auto-open the camera.",
  photoKind: "product",
});
