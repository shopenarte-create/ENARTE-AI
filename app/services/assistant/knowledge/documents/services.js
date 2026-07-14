/**
 * Knowledge Module 3 — services
 * Content provided by ENARTE. Do not invent or alter business meaning.
 */

import { KNOWLEDGE_MODULE_ID } from "../constants.js";
import { createServicesContent } from "../schemas/content.js";

/** Canonical contact for installation / electrician / site inspection. */
const SHARED_SERVICE_PHONE = "+962782404023";
const SHARED_SERVICE_PHONE_DISPLAY = "00962782404023";

const INSTALLATION_REPLY = Object.freeze({
  ar: `يوجد فريق تركيب مختص يمكنك التواصل معهم على الرقم ${SHARED_SERVICE_PHONE_DISPLAY}. لمعلومة عامة: ثبّت القاعدة جيداً واتبع خطوات التركيب حسب الكتالوج/دليل المنتج المرفق مع القطعة.`,
  en: `We have a specialized installation team — contact ${SHARED_SERVICE_PHONE_DISPLAY}. General tip: fix the mounting base firmly and follow the installation steps in the product catalog/manual included with the fixture.`,
});

const SITE_INSPECTION_REPLY = Object.freeze({
  ar: `أكيد موجود. يمكنك التواصل مع الرقم ${SHARED_SERVICE_PHONE_DISPLAY} لحجز موعد، علماً أن الكشف مجاني داخل عمان، وخارج عمان يتم خصم قيمة الكشف في حال تم الشراء.`,
  en: `Yes, site inspection is available. Contact ${SHARED_SERVICE_PHONE_DISPLAY} to book an appointment. Inspection is free inside Amman; outside Amman the inspection fee is deducted if you purchase.`,
});

/**
 * Structured ENARTE services knowledge (exact business knowledge).
 */
export function buildServicesContent() {
  return createServicesContent({
    contact: {
      phone: SHARED_SERVICE_PHONE,
      forServices: Object.freeze([
        "installation",
        "maintenance",
        "site_inspection",
      ]),
    },
    offerings: Object.freeze([
      Object.freeze({
        id: "installation",
        name: Object.freeze({
          ar: "خدمة التركيب",
          en: "Installation Service",
        }),
        available: true,
        customersCanRequest: true,
        contactPhone: SHARED_SERVICE_PHONE,
        description: INSTALLATION_REPLY,
      }),
      Object.freeze({
        id: "maintenance",
        name: Object.freeze({
          ar: "خدمة الصيانة",
          en: "Maintenance Service",
        }),
        available: true,
        customersCanRequest: true,
        contactPhone: SHARED_SERVICE_PHONE,
        description: Object.freeze({
          ar: `خدمة الصيانة متاحة. يمكنك التواصل على الرقم ${SHARED_SERVICE_PHONE_DISPLAY}`,
          en: `Maintenance is available. Contact ${SHARED_SERVICE_PHONE_DISPLAY}`,
        }),
      }),
      Object.freeze({
        id: "site_inspection",
        name: Object.freeze({
          ar: "معاينة الموقع",
          en: "Site Inspection",
        }),
        available: true,
        customersCanRequest: true,
        customersCanRequestSiteVisitBeforePurchasing: true,
        contactPhone: SHARED_SERVICE_PHONE,
        suitableFor: Object.freeze([
          "projects",
          "villas",
          "apartments",
          "offices",
          "restaurants",
          "hotels",
          "custom_lighting_projects",
        ]),
        freeInspectionInsideAmman: true,
        outsideAmmanInspectionFeeDeductedOnPurchase: true,
        description: SITE_INSPECTION_REPLY,
      }),
      Object.freeze({
        id: "custom_lighting",
        name: Object.freeze({
          ar: "إضاءة مخصصة",
          en: "Custom Lighting",
        }),
        availableWhenApplicable: true,
        customersCanRequestCustomChandeliers: true,
        customersCanRequestCustomLightingProjects: true,
        collectRequestAndDirectToResponsibleTeam: true,
        description: Object.freeze({
          ar: "توفر ENARTE حلول إضاءة مخصصة عند الاقتضاء. يمكن طلب نجف مخصص أو مشاريع إضاءة مخصصة؛ يجمع المساعد الطلب ويوجهه للفريق المختص.",
          en: "ENARTE provides custom lighting solutions when applicable. Customers can request custom chandeliers or custom lighting projects. The assistant should collect the request and direct it to the responsible team.",
        }),
      }),
    ]),
    categories: Object.freeze([
      "installation",
      "maintenance",
      "site_inspection",
      "custom_lighting",
    ]),
    disclaimers: Object.freeze([
      Object.freeze({
        id: "general_lighting_safety_only",
        summary:
          "Give only general installation tips (secure the base; follow the product catalog/manual) and general electrical-safety advice for issues like a short. Full repairs and live electrical work must go to the ENARTE installation team phone.",
      }),
    ]),
    customLighting: {
      availableWhenApplicable: true,
      acceptCustomChandelierRequests: true,
      acceptCustomLightingProjectRequests: true,
      collectRequestAndDirectToResponsibleTeam: true,
      messages: {
        ar: "توفر ENARTE حلول إضاءة مخصصة عند الاقتضاء. أخبرني بطلبك وسأوجّهه للفريق المختص.",
        en: "ENARTE provides custom lighting solutions when applicable. Share your request and I will direct it to the responsible team.",
      },
    },
    serviceRules: {
      // Allow brief general tips; forbid unsafe DIY repair procedures.
      doNotProvideTechnicalRepairGuidance: true,
      whenAskingHowToInstallChandelier: true,
      whenAskingToFixElectricalIssue: true,
      allowGeneralInstallationTips: true,
      allowGeneralElectricalSafetyAdvice: true,
      messages: INSTALLATION_REPLY,
    },
  });
}

export const SERVICES_MODULE_ID = KNOWLEDGE_MODULE_ID.SERVICES;

export const SERVICES_VERSION = "1.2.0";
