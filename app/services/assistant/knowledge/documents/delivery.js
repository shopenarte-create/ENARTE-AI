/**
 * Knowledge Module 4 — delivery
 * Content provided by ENARTE. Do not invent or alter business meaning.
 * Do not implement delivery workflow logic here — knowledge only.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { createDeliveryContent } from "../schemas/content.js";

/**
 * Structured ENARTE delivery knowledge (exact current business rules +
 * future-ready extensibility hooks).
 */
export function buildDeliveryContent() {
  return createDeliveryContent({
    amman: {
      supported: true,
      estimatedDelivery: {
        minHours: 6,
        maxHours: 8,
        unit: "hours",
      },
      messages: {
        ar: "التوصيل داخل عمّان خلال 6–8 ساعات تقريباً.",
        en: "Delivery inside Amman is estimated at 6–8 hours.",
      },
    },
    otherCities: {
      supported: true,
      timesConfigurable: true,
      doNotHardcodeEstimates: true,
      estimatedDelivery: null,
      messages: {
        ar: "التوصيل إلى المدن الأخرى متاح. سيتم تأكيد وقت التوصيل بعد مراجعة الطلب.",
        en: "Delivery to other cities is supported. Delivery time will be confirmed after the order is reviewed.",
      },
    },
    customerCommunication: {
      alwaysProvideEstimatedTimeWhenAvailable: true,
      ifUnknownPolitelyInformConfirmedAfterOrderReview: true,
      messages: {
        estimatedAvailable: {
          ar: "الوقت التقديري للتوصيل: {estimate}.",
          en: "Estimated delivery time: {estimate}.",
        },
        unknown: {
          ar: "وقت التوصيل غير معروف حالياً، وسيتم تأكيده بعد مراجعة الطلب.",
          en: "The delivery time is currently unknown and will be confirmed after the order is reviewed.",
        },
      },
    },
    regions: Object.freeze([
      Object.freeze({
        id: "amman",
        name: Object.freeze({ ar: "عمّان", en: "Amman" }),
        supported: true,
        estimatedDelivery: Object.freeze({
          minHours: 6,
          maxHours: 8,
          unit: "hours",
          configurable: false,
        }),
      }),
      Object.freeze({
        id: "other_cities",
        name: Object.freeze({ ar: "مدن أخرى", en: "Other cities" }),
        supported: true,
        timesConfigurable: true,
        doNotHardcodeEstimates: true,
        estimatedDelivery: null,
      }),
    ]),
    options: Object.freeze([]),
    constraints: Object.freeze([
      Object.freeze({
        id: "other_cities_no_hardcoded_estimates",
        summary:
          "Delivery times for other cities must remain configurable; do not hardcode delivery estimates.",
      }),
    ]),
    sla: {
      standardDays: null,
      expressDays: null,
    },
    zones: Object.freeze([]),
    pricing: {
      enabled: false,
      entries: Object.freeze([]),
    },
    expressDelivery: {
      enabled: false,
      options: Object.freeze([]),
    },
    scheduledDelivery: {
      enabled: false,
      options: Object.freeze([]),
    },
    orderTracking: {
      enabled: false,
      providers: Object.freeze([]),
    },
    shippingProviders: Object.freeze([]),
    holidaySchedules: Object.freeze([]),
    futureSupport: {
      deliveryZones: true,
      deliveryPricing: true,
      expressDelivery: true,
      scheduledDelivery: true,
      orderTracking: true,
      shippingProviders: true,
      holidaySchedules: true,
    },
  });
}

export const DELIVERY_MODULE_ID = KNOWLEDGE_MODULE_ID.DELIVERY;

export const DELIVERY_VERSION = "1.0.0";
