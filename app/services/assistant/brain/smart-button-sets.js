/**
 * Map smart button sets → action ids shown after decisions.
 * Labels still come from smart-actions config (UX), not business rules.
 */

import { SMART_BUTTON_SET } from "./constants.js";
import {
  SMART_ACTION_IDS,
  getSmartAction,
  listSmartActions,
  resolveActionLabel,
} from "../ux/smart-actions.js";

const SET_TO_ACTION_IDS = Object.freeze({
  [SMART_BUTTON_SET.NONE]: Object.freeze([]),
  [SMART_BUTTON_SET.WELCOME]: null, // all welcome actions
  [SMART_BUTTON_SET.AFTER_CLARIFY]: null,
  [SMART_BUTTON_SET.AFTER_PRODUCTS]: Object.freeze([
    SMART_ACTION_IDS.CHECKOUT,
    SMART_ACTION_IDS.RECOMMEND_PRODUCTS,
    SMART_ACTION_IDS.SEARCH_PRODUCT,
    SMART_ACTION_IDS.DELIVERY,
    SMART_ACTION_IDS.INSTALLATION_MAINTENANCE,
    SMART_ACTION_IDS.TALK_TO_ASSISTANT,
  ]),
  [SMART_BUTTON_SET.AFTER_NO_MATCH]: Object.freeze([
    SMART_ACTION_IDS.SEARCH_PRODUCT,
    SMART_ACTION_IDS.CHANDELIERS,
    SMART_ACTION_IDS.SUGGESTIONS_FEEDBACK,
    SMART_ACTION_IDS.TALK_TO_ASSISTANT,
  ]),
  [SMART_BUTTON_SET.AFTER_IMAGE_NO_MATCH]: Object.freeze([
    SMART_ACTION_IDS.DESCRIBE_LOOKING_FOR,
    SMART_ACTION_IDS.SEARCH_PRODUCT,
    SMART_ACTION_IDS.TALK_TO_ASSISTANT,
    SMART_ACTION_IDS.SUGGESTIONS_FEEDBACK,
  ]),
});

/**
 * Resolve UI smart actions for a button set.
 */
export function resolveSmartButtonSet(setId, locale = "ar") {
  if (!setId || setId === SMART_BUTTON_SET.NONE) {
    return Object.freeze([]);
  }

  const ids = SET_TO_ACTION_IDS[setId];
  if (ids == null) {
    return listSmartActions({ welcomeOnly: true }).map((a) => {
      const full = getSmartAction(a.id);
      return Object.freeze({
        id: a.id,
        label: resolveActionLabel(full, locale),
        workflowId: a.workflowId,
      });
    });
  }

  return Object.freeze(
    ids
      .map((id) => getSmartAction(id))
      .filter(Boolean)
      .map((full) =>
        Object.freeze({
          id: full.id,
          label: resolveActionLabel(full, locale),
          workflowId: full.workflowId,
        }),
      ),
  );
}
