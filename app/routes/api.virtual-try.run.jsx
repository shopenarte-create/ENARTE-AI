import { peekTryHandoff } from "../services/placement/try-handoff.server.js";
import {
  resolveBudgetInput,
  DEFAULT_BUDGET_ID,
} from "../services/budget.js";
import {
  startVirtualTryPipeline,
  continueVirtualTryPipeline,
  normalizeFixtureCount,
} from "../services/virtual-try/index.js";
import { normalizeProductId } from "../services/placement/product-entry.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function parseProductField(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && raw.id) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      id: normalizeProductId(parsed.id) || parsed.id || null,
      title: parsed.title || "",
      image: parsed.image || null,
      price: parsed.price ?? null,
      currency: parsed.currency || "JOD",
      url: parsed.url || null,
      collection: parsed.collection || null,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/virtual-try/run
 * multipart: roomImage | handoffId, count, budget?, style?, product?,
 *            forceCount?, acceptSuggestedCount?, jobId? (resume)
 */
export async function action({ request }) {
  try {
    const formData = await request.formData();
    const resumeJobId = String(formData.get("jobId") || "").trim();

    if (resumeJobId) {
      const forceCount =
        String(formData.get("forceCount") || "") === "1" ||
        String(formData.get("forceCount") || "") === "true";
      const acceptSuggestedCount =
        String(formData.get("acceptSuggestedCount") || "") === "1" ||
        String(formData.get("acceptSuggestedCount") || "") === "true";

      const jobId = continueVirtualTryPipeline(resumeJobId, {
        forceCount,
        acceptSuggestedCount,
      });

      return json(
        {
          success: true,
          async: true,
          jobId,
          statusUrl: `/api/virtual-try/status?id=${encodeURIComponent(jobId)}`,
        },
        202,
      );
    }

    const handoffId = String(formData.get("handoffId") || "").trim();
    const roomImage = formData.get("roomImage");
    const count = normalizeFixtureCount(formData.get("count") || "1");
    const style = String(formData.get("style") || "").trim();
    const shop = String(formData.get("shop") || "").trim() || null;
    const forceCount =
      String(formData.get("forceCount") || "") === "1" ||
      String(formData.get("forceCount") || "") === "true";
    const acceptSuggestedCount =
      String(formData.get("acceptSuggestedCount") || "") === "1" ||
      String(formData.get("acceptSuggestedCount") || "") === "true";

    const budgetResolved = resolveBudgetInput(formData.get("budget"));
    if (!budgetResolved.ok) {
      return json({ success: false, error: budgetResolved.error }, 400);
    }

    let lockedProduct = parseProductField(formData.get("product"));
    let roomBuffer = null;
    let mimeType = "image/jpeg";

    if (handoffId) {
      const entry = await peekTryHandoff(handoffId);
      if (!entry?.buffer) {
        return json(
          { success: false, error: "انتهت صلاحية صورة الغرفة — ارفعها من جديد." },
          410,
        );
      }
      roomBuffer = entry.buffer;
      mimeType = entry.mimeType || "image/jpeg";
      // Product-page handoff: keep the exact SKU the customer asked to try.
      if (!lockedProduct && entry.product) {
        lockedProduct = entry.product;
      }
    } else if (roomImage && typeof roomImage !== "string" && roomImage.arrayBuffer) {
      roomBuffer = Buffer.from(await roomImage.arrayBuffer());
      mimeType = roomImage.type || "image/jpeg";
    } else {
      return json({ success: false, error: "صورة الغرفة مطلوبة." }, 400);
    }

    if (!lockedProduct?.id && !lockedProduct?.image) {
      return json(
        {
          success: false,
          error:
            "يجب اختيار منتج قبل التركيب. من الرئيسية اختر من الاقتراحات، ومن صفحة المنتج يُستخدم المنتج الحالي.",
        },
        400,
      );
    }

    const jobId = startVirtualTryPipeline({
      roomImage: roomBuffer,
      mimeType,
      count,
      budgetId: budgetResolved.budgetId || DEFAULT_BUDGET_ID,
      style: style || undefined,
      lockedProduct,
      forceCount,
      acceptSuggestedCount,
      shop,
    });

    return json(
      {
        success: true,
        async: true,
        jobId,
        statusUrl: `/api/virtual-try/status?id=${encodeURIComponent(jobId)}`,
      },
      202,
    );
  } catch (error) {
    console.error("[virtual-try/run]", error);
    const status = error?.code === "JOB_NOT_FOUND" ? 404 : 500;
    return json(
      {
        success: false,
        code: error?.code || "VIRTUAL_TRY_FAILED",
        error: error?.message || "تعذر بدء تجربة الغرفة",
      },
      status,
    );
  }
}
