import { SHOP_DOMAIN } from "../config";
import { ApiError, apiFetch } from "./client";
import type { CartLine } from "../cart/CartContext";

export type OrderCustomer = {
  name: string;
  phone: string;
  governorate: string;
  address?: string;
};

export type PaymentMethod = "cod" | "cliq" | "online";

export const PAYMENT_METHODS: {
  id: PaymentMethod;
  title: string;
  detail: string;
}[] = [
  {
    id: "cod",
    title: "الدفع عند الاستلام",
    detail: "ادفع نقداً عند استلام الطلب",
  },
  {
    id: "cliq",
    title: "الدفع عبر كليك (CliQ)",
    detail: "00962782404023 — الحساب باسم: لانا عماد عطاالله",
  },
  {
    id: "online",
    title: "الدفع الإلكتروني",
    detail: "متابعة الدفع عبر بوابة المتجر بعد تأكيد الطلب",
  },
];

export const CLIQ_PAYMENT = {
  phone: "00962782404023",
  accountName: "لانا عماد عطاالله",
} as const;

export const CUSTOMER_ACK_AR =
  "لقد تم استلام طلبكم وسنبدأ التجهيز ونتواصل معكم للتسليم. شكراً لثقتكم بـ ENARTE.";

export type OrderSubmitResult = {
  ok: boolean;
  orderId?: string;
  customerMessage?: string;
  paymentMethod?: PaymentMethod;
  paymentLabel?: string;
  shopify?: {
    ok?: boolean;
    draftOrderId?: string | null;
    draftOrderName?: string | null;
    reason?: string | null;
  };
  email?: { ok?: boolean; skipped?: boolean; to?: string; reason?: string };
  next?: { canContinueToPayment?: boolean; messageAr?: string };
  message?: string;
  error?: string;
};

export const JORDAN_GOVERNORATES = [
  "عمّان",
  "إربد",
  "الزرقاء",
  "البلقاء",
  "المفرق",
  "جرش",
  "عجلون",
  "مادبا",
  "الكرك",
  "الطفيلة",
  "معان",
  "العقبة",
] as const;

export function orderErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "invalid_json" || err.status === 404) {
      return "خدمة الطلبات غير جاهزة حالياً. حاول مرة أخرى بعد قليل.";
    }
    if (err.code === "network_error" || err.status === 0) {
      return "لا يوجد اتصال بالإنترنت. تحقق ثم أعد المحاولة.";
    }
    if (err.code === "order_delivery_failed" || err.status === 503) {
      return "تعذر تسجيل الطلب حالياً. يرجى المحاولة بعد قليل.";
    }
    return err.message || "تعذر إرسال الطلب";
  }
  if (err instanceof Error) return err.message;
  return "تعذر إرسال الطلب";
}

export async function submitMobileOrder(params: {
  customer: OrderCustomer;
  items: CartLine[];
  paymentMethod: PaymentMethod;
  note?: string;
  shop?: string;
}): Promise<OrderSubmitResult> {
  return apiFetch<OrderSubmitResult>("/api/mobile/orders", {
    method: "POST",
    body: JSON.stringify({
      customer: params.customer,
      paymentMethod: params.paymentMethod,
      items: params.items.map((line) => ({
        productId: line.productId,
        productTitle: line.productTitle,
        handle: line.handle,
        image: line.image,
        url: line.url,
        variantId: line.variantId,
        variantNumericId: line.variantNumericId,
        variantTitle: line.variantTitle,
        price: line.price,
        currency: line.currency,
        quantity: line.quantity,
      })),
      note: params.note || "",
      shop: params.shop || SHOP_DOMAIN,
      currency: params.items[0]?.currency || "JOD",
    }),
  });
}
