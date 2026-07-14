/**
 * Per-module content schemas — shapes + factories.
 * Business values live in knowledge/documents/* when ENARTE provides them.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";

function localeMap(value = {}) {
  return Object.freeze({ ...(value || {}) });
}

/** @returns {object} assistant_personality content */
export function createAssistantPersonalityContent(overrides = {}) {
  const identity = overrides.identity || {};
  const tone = overrides.tone || {};
  const mission = overrides.mission || {};
  const specialization = overrides.specialization || {};
  const conversationPrinciples = overrides.conversationPrinciples || {};
  const productRules = overrides.productRules || {};
  const sourcing = overrides.sourcing || {};
  const whenUnavailable = sourcing.whenUnavailable || {};
  const imageSearch = overrides.imageSearch || {};
  const roomRecommendation = overrides.roomRecommendation || {};
  const messages = overrides.messages || {};
  const constraints = overrides.constraints || {};

  return Object.freeze({
    identity: Object.freeze({
      name: identity.name ?? null,
      role: identity.role ?? null,
      brandRef: identity.brandRef ?? null,
      representsOnly: identity.representsOnly ?? null,
      isGeneralAi: identity.isGeneralAi ?? null,
    }),
    tone: Object.freeze({
      formality: tone.formality ?? null,
      warmth: tone.warmth ?? null,
      expertiseLevel: tone.expertiseLevel ?? null,
      traits: Object.freeze([...(tone.traits || [])]),
      neverOverwhelmWithLongParagraphs:
        tone.neverOverwhelmWithLongParagraphs ?? null,
      preferSmartActionButtons: tone.preferSmartActionButtons ?? null,
    }),
    mission: Object.freeze({
      goals: Object.freeze([...(mission.goals || [])]),
    }),
    specialization: Object.freeze({
      domains: Object.freeze([...(specialization.domains || [])]),
      outOfScopePolicy: specialization.outOfScopePolicy ?? null,
      outOfScopeBehavior: specialization.outOfScopeBehavior ?? null,
    }),
    conversationPrinciples: Object.freeze({
      askOnlyOneClarificationAtATime:
        conversationPrinciples.askOnlyOneClarificationAtATime ?? null,
      neverAskUnnecessaryQuestions:
        conversationPrinciples.neverAskUnnecessaryQuestions ?? null,
      guideStepByStep: conversationPrinciples.guideStepByStep ?? null,
      preferSmartActionButtons:
        conversationPrinciples.preferSmartActionButtons ?? null,
    }),
    productRules: Object.freeze({
      recommendEnarteOnly: productRules.recommendEnarteOnly ?? null,
      neverRecommendInternetProducts:
        productRules.neverRecommendInternetProducts ?? null,
      neverInventProducts: productRules.neverInventProducts ?? null,
    }),
    sourcing: Object.freeze({
      whenUnavailable: Object.freeze({
        informTrySourceWithinDays:
          whenUnavailable.informTrySourceWithinDays ?? null,
        informIfImpossibleWithinHours:
          whenUnavailable.informIfImpossibleWithinHours ?? null,
        createProductSourcingRequest:
          whenUnavailable.createProductSourcingRequest ?? null,
      }),
      messages: localeMap(sourcing.messages),
    }),
    imageSearch: Object.freeze({
      askForPhotoWhenAppropriate:
        imageSearch.askForPhotoWhenAppropriate ?? null,
      searchSameOrSimilarEnarteOnly:
        imageSearch.searchSameOrSimilarEnarteOnly ?? null,
      messages: Object.freeze({
        askForPhoto: localeMap(imageSearch.messages?.askForPhoto),
      }),
    }),
    roomRecommendation: Object.freeze({
      askForRoomPhotoWhenAppropriate:
        roomRecommendation.askForRoomPhotoWhenAppropriate ?? null,
      explainCanRecommendSuitableLighting:
        roomRecommendation.explainCanRecommendSuitableLighting ?? null,
      explainVirtualPlacementLater:
        roomRecommendation.explainVirtualPlacementLater ?? null,
      messages: Object.freeze({
        askForRoomPhoto: localeMap(
          roomRecommendation.messages?.askForRoomPhoto,
        ),
      }),
    }),
    messages: Object.freeze({
      greeting: localeMap(messages.greeting),
      help: localeMap(messages.help),
      clarify: localeMap(messages.clarify),
      outOfDomain: localeMap(messages.outOfDomain),
      chandelierRoomClarify: localeMap(messages.chandelierRoomClarify),
      fanRoomClarify: localeMap(messages.fanRoomClarify),
      outdoorSpaceClarify: localeMap(messages.outdoorSpaceClarify),
      productsFoundIntro: localeMap(messages.productsFoundIntro),
      similarProductsIntro: localeMap(messages.similarProductsIntro),
      recommendationsIntro: localeMap(messages.recommendationsIntro),
      productInterestConsult: localeMap(messages.productInterestConsult),
      productInterestWithTopic: localeMap(messages.productInterestWithTopic),
      checkoutHandoff: localeMap(messages.checkoutHandoff),
      adminNotifyAck: localeMap(messages.adminNotifyAck),
      feedbackPrompt: localeMap(messages.feedbackPrompt),
      feedbackAck: localeMap(messages.feedbackAck),
      imageSearchDisabled: localeMap(messages.imageSearchDisabled),
      roomAnalysisDisabled: localeMap(messages.roomAnalysisDisabled),
      virtualPlacementDisabled: localeMap(messages.virtualPlacementDisabled),
    }),
    constraints: Object.freeze({
      maxClarifyingQuestions: constraints.maxClarifyingQuestions ?? null,
      allowHumor: constraints.allowHumor ?? null,
      shortAndClear: constraints.shortAndClear ?? null,
      preferSmartActionButtons: constraints.preferSmartActionButtons ?? null,
      neverOverwhelmWithLongParagraphs:
        constraints.neverOverwhelmWithLongParagraphs ?? null,
    }),
  });
}

/** @returns {object} business_rules content */
export function createBusinessRulesContent(overrides = {}) {
  const delivery = overrides.delivery || {};
  const amman = delivery.amman || {};
  const otherCities = delivery.otherCities || {};
  const installationMaintenance = overrides.installationMaintenance || {};
  const contact = installationMaintenance.contact || {};
  const garageLighting = overrides.garageLighting || {};
  const productSearch = overrides.productSearch || {};
  const unavailableProducts = overrides.unavailableProducts || {};
  const returnsExchange = overrides.returnsExchange || {};
  const roomRecommendation = overrides.roomRecommendation || {};
  const imageSearch = overrides.imageSearch || {};
  const buttonsPolicy = overrides.buttonsPolicy || {};
  const generalRules = overrides.generalRules || {};

  return Object.freeze({
    delivery: Object.freeze({
      amman: Object.freeze({
        minHours: amman.minHours ?? null,
        maxHours: amman.maxHours ?? null,
        unit: amman.unit ?? null,
      }),
      otherCities: Object.freeze({
        configurableLater: otherCities.configurableLater ?? null,
      }),
      messages: localeMap(delivery.messages),
    }),
    installationMaintenance: Object.freeze({
      available: installationMaintenance.available ?? null,
      services: Object.freeze([
        ...(installationMaintenance.services || []),
      ]),
      contact: Object.freeze({
        phone: contact.phone ?? null,
        forServices: Object.freeze([...(contact.forServices || [])]),
      }),
      messages: localeMap(installationMaintenance.messages),
    }),
    garageLighting: Object.freeze({
      considerRainAndHumidity:
        garageLighting.considerRainAndHumidity ?? null,
      recommendOnlyOutdoorWeatherResistant:
        garageLighting.recommendOnlyOutdoorWeatherResistant ?? null,
      messages: localeMap(garageLighting.messages),
    }),
    productSearch: Object.freeze({
      searchEnarteCatalogOnly: productSearch.searchEnarteCatalogOnly ?? null,
      neverSearchInternet: productSearch.neverSearchInternet ?? null,
      neverRecommendOutsideEnarte:
        productSearch.neverRecommendOutsideEnarte ?? null,
    }),
    unavailableProducts: Object.freeze({
      informTrySourceWithinDays:
        unavailableProducts.informTrySourceWithinDays ?? null,
      informIfUnsuccessfulWithinHours:
        unavailableProducts.informIfUnsuccessfulWithinHours ?? null,
      createProductSourcingRequest:
        unavailableProducts.createProductSourcingRequest ?? null,
      messages: localeMap(unavailableProducts.messages),
    }),
    returnsExchange: Object.freeze({
      withinHours: returnsExchange.withinHours ?? null,
      allowExchange: returnsExchange.allowExchange ?? null,
      allowReturn: returnsExchange.allowReturn ?? null,
      condition: returnsExchange.condition ?? null,
      messages: localeMap(returnsExchange.messages),
    }),
    roomRecommendation: Object.freeze({
      offerRoomPhotoAnalysisWhenLookingForRoomLighting:
        roomRecommendation.offerRoomPhotoAnalysisWhenLookingForRoomLighting ??
        null,
      explainCanRecommendSuitableLighting:
        roomRecommendation.explainCanRecommendSuitableLighting ?? null,
      explainVirtualPlacementLater:
        roomRecommendation.explainVirtualPlacementLater ?? null,
      messages: localeMap(roomRecommendation.messages),
    }),
    imageSearch: Object.freeze({
      offerWheneverAppropriate:
        imageSearch.offerWheneverAppropriate ?? null,
      searchSameOrClosestEnarteOnly:
        imageSearch.searchSameOrClosestEnarteOnly ?? null,
      messages: localeMap(imageSearch.messages),
    }),
    buttonsPolicy: Object.freeze({
      preferSmartActionButtons:
        buttonsPolicy.preferSmartActionButtons ?? null,
      keepConversationSimpleAndFast:
        buttonsPolicy.keepConversationSimpleAndFast ?? null,
    }),
    generalRules: Object.freeze({
      doNotInventInformation: generalRules.doNotInventInformation ?? null,
      doNotInventProducts: generalRules.doNotInventProducts ?? null,
      doNotInventPrices: generalRules.doNotInventPrices ?? null,
      doNotInventAvailability: generalRules.doNotInventAvailability ?? null,
      alwaysRelyOnEnarteKnowledgeAndCatalog:
        generalRules.alwaysRelyOnEnarteKnowledgeAndCatalog ?? null,
    }),
    rules: Object.freeze([...(overrides.rules || [])]),
    policies: Object.freeze([...(overrides.policies || [])]),
    escalation: Object.freeze({
      channels: Object.freeze([...(overrides.escalation?.channels || [])]),
    }),
  });
}

/** @returns {object} services content */
export function createServicesContent(overrides = {}) {
  const contact = overrides.contact || {};
  const customLighting = overrides.customLighting || {};
  const serviceRules = overrides.serviceRules || {};

  return Object.freeze({
    offerings: Object.freeze([...(overrides.offerings || [])]),
    categories: Object.freeze([...(overrides.categories || [])]),
    disclaimers: Object.freeze([...(overrides.disclaimers || [])]),
    contact: Object.freeze({
      phone: contact.phone ?? null,
      forServices: Object.freeze([...(contact.forServices || [])]),
    }),
    customLighting: Object.freeze({
      availableWhenApplicable: customLighting.availableWhenApplicable ?? null,
      acceptCustomChandelierRequests:
        customLighting.acceptCustomChandelierRequests ?? null,
      acceptCustomLightingProjectRequests:
        customLighting.acceptCustomLightingProjectRequests ?? null,
      collectRequestAndDirectToResponsibleTeam:
        customLighting.collectRequestAndDirectToResponsibleTeam ?? null,
      messages: localeMap(customLighting.messages),
    }),
    serviceRules: Object.freeze({
      doNotProvideTechnicalRepairGuidance:
        serviceRules.doNotProvideTechnicalRepairGuidance ?? null,
      whenAskingHowToInstallChandelier:
        serviceRules.whenAskingHowToInstallChandelier ?? null,
      whenAskingToFixElectricalIssue:
        serviceRules.whenAskingToFixElectricalIssue ?? null,
      messages: localeMap(serviceRules.messages),
    }),
  });
}

/** @returns {object} delivery content */
export function createDeliveryContent(overrides = {}) {
  const customerCommunication = overrides.customerCommunication || {};
  const amman = overrides.amman || {};
  const otherCities = overrides.otherCities || {};
  const futureSupport = overrides.futureSupport || {};
  const pricing = overrides.pricing || {};
  const expressDelivery = overrides.expressDelivery || {};
  const scheduledDelivery = overrides.scheduledDelivery || {};
  const orderTracking = overrides.orderTracking || {};

  return Object.freeze({
    amman: Object.freeze({
      supported: amman.supported ?? null,
      estimatedDelivery: Object.freeze({
        minHours: amman.estimatedDelivery?.minHours ?? null,
        maxHours: amman.estimatedDelivery?.maxHours ?? null,
        unit: amman.estimatedDelivery?.unit ?? null,
      }),
      messages: localeMap(amman.messages),
    }),
    otherCities: Object.freeze({
      supported: otherCities.supported ?? null,
      timesConfigurable: otherCities.timesConfigurable ?? null,
      doNotHardcodeEstimates: otherCities.doNotHardcodeEstimates ?? null,
      estimatedDelivery: otherCities.estimatedDelivery ?? null,
      messages: localeMap(otherCities.messages),
    }),
    customerCommunication: Object.freeze({
      alwaysProvideEstimatedTimeWhenAvailable:
        customerCommunication.alwaysProvideEstimatedTimeWhenAvailable ?? null,
      ifUnknownPolitelyInformConfirmedAfterOrderReview:
        customerCommunication.ifUnknownPolitelyInformConfirmedAfterOrderReview ??
        null,
      messages: Object.freeze({
        estimatedAvailable: localeMap(
          customerCommunication.messages?.estimatedAvailable,
        ),
        unknown: localeMap(customerCommunication.messages?.unknown),
      }),
    }),
    regions: Object.freeze([...(overrides.regions || [])]),
    options: Object.freeze([...(overrides.options || [])]),
    constraints: Object.freeze([...(overrides.constraints || [])]),
    sla: Object.freeze({
      standardDays: overrides.sla?.standardDays ?? null,
      expressDays: overrides.sla?.expressDays ?? null,
    }),
    /** Future-ready extensibility (empty / disabled until ENARTE supplies data). */
    zones: Object.freeze([...(overrides.zones || [])]),
    pricing: Object.freeze({
      enabled: pricing.enabled ?? null,
      entries: Object.freeze([...(pricing.entries || [])]),
    }),
    expressDelivery: Object.freeze({
      enabled: expressDelivery.enabled ?? null,
      options: Object.freeze([...(expressDelivery.options || [])]),
    }),
    scheduledDelivery: Object.freeze({
      enabled: scheduledDelivery.enabled ?? null,
      options: Object.freeze([...(scheduledDelivery.options || [])]),
    }),
    orderTracking: Object.freeze({
      enabled: orderTracking.enabled ?? null,
      providers: Object.freeze([...(orderTracking.providers || [])]),
    }),
    shippingProviders: Object.freeze([
      ...(overrides.shippingProviders || []),
    ]),
    holidaySchedules: Object.freeze([
      ...(overrides.holidaySchedules || []),
    ]),
    futureSupport: Object.freeze({
      deliveryZones: futureSupport.deliveryZones ?? null,
      deliveryPricing: futureSupport.deliveryPricing ?? null,
      expressDelivery: futureSupport.expressDelivery ?? null,
      scheduledDelivery: futureSupport.scheduledDelivery ?? null,
      orderTracking: futureSupport.orderTracking ?? null,
      shippingProviders: futureSupport.shippingProviders ?? null,
      holidaySchedules: futureSupport.holidaySchedules ?? null,
    }),
  });
}

export function createFaqContent(overrides = {}) {
  return Object.freeze({
    items: Object.freeze([...(overrides.items || [])]),
    categories: Object.freeze([...(overrides.categories || [])]),
  });
}

export const CONTENT_FACTORIES = Object.freeze({
  [KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY]: createAssistantPersonalityContent,
  [KNOWLEDGE_MODULE_ID.BUSINESS_RULES]: createBusinessRulesContent,
  [KNOWLEDGE_MODULE_ID.SERVICES]: createServicesContent,
  [KNOWLEDGE_MODULE_ID.DELIVERY]: createDeliveryContent,
  [KNOWLEDGE_MODULE_ID.FAQ]: createFaqContent,
});

export const CONTENT_REQUIRED_KEYS = Object.freeze({
  [KNOWLEDGE_MODULE_ID.ASSISTANT_PERSONALITY]: Object.freeze([
    "identity",
    "tone",
    "specialization",
    "messages",
    "constraints",
    "mission",
    "conversationPrinciples",
    "productRules",
    "sourcing",
    "imageSearch",
    "roomRecommendation",
  ]),
  [KNOWLEDGE_MODULE_ID.BUSINESS_RULES]: Object.freeze([
    "delivery",
    "installationMaintenance",
    "garageLighting",
    "productSearch",
    "unavailableProducts",
    "returnsExchange",
    "roomRecommendation",
    "imageSearch",
    "buttonsPolicy",
    "generalRules",
    "rules",
    "policies",
    "escalation",
  ]),
  [KNOWLEDGE_MODULE_ID.SERVICES]: Object.freeze([
    "offerings",
    "categories",
    "disclaimers",
    "contact",
    "customLighting",
    "serviceRules",
  ]),
  [KNOWLEDGE_MODULE_ID.DELIVERY]: Object.freeze([
    "amman",
    "otherCities",
    "customerCommunication",
    "regions",
    "options",
    "constraints",
    "sla",
    "zones",
    "pricing",
    "expressDelivery",
    "scheduledDelivery",
    "orderTracking",
    "shippingProviders",
    "holidaySchedules",
    "futureSupport",
  ]),
  [KNOWLEDGE_MODULE_ID.FAQ]: Object.freeze(["items", "categories"]),
});
