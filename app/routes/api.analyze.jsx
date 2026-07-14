import OpenAI from "openai";
import sharp from "sharp";
import {
  getBudgetPromptContext,
  getBudgetRange,
  resolveBudgetInput,
  wasBudgetExplicitlySelected,
} from "../services/budget.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_ANALYSIS_PROMPT = `
أنت خبير إنارة لدى ENARTE. حلّل صورة الغرفة بالعربية باختصار شديد (أقل من 120 كلمة):
نوع الغرفة، المساحة التقريبية، ارتفاع السقف، الستايل، الألوان، شكل/قطر/لون الثريا المناسب، حرارة الإضاءة، وسبب قصير.
`.trim();

async function prepareVisionImage(file) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(bytes)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  return {
    base64: optimized.toString("base64"),
    mime: "image/jpeg",
  };
}

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const budgetResolved = resolveBudgetInput(formData.get("budget"));

    if (!budgetResolved.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: budgetResolved.error,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!image || typeof image === "string" || !image.arrayBuffer) {
      return new Response(
        JSON.stringify({ success: false, error: "صورة الغرفة مطلوبة" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const budgetRange = getBudgetRange(budgetResolved.budgetId);
    const budgetExplicit = wasBudgetExplicitlySelected(formData.get("budget"));
    const budgetPromptContext = getBudgetPromptContext(budgetResolved.budgetId);
    const analysisPrompt = budgetPromptContext
      ? `${BASE_ANALYSIS_PROMPT}\n\n${budgetPromptContext}`
      : BASE_ANALYSIS_PROMPT;

    const { base64, mime } = await prepareVisionImage(image);

    const response = await openai.responses.create({
      model: process.env.ENARTE_ANALYZE_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: analysisPrompt },
            {
              type: "input_image",
              image_url: `data:${mime};base64,${base64}`,
            },
          ],
        },
      ],
    });

    return new Response(
      JSON.stringify({
        success: true,
        result: response.output_text,
        budget: budgetRange.id,
        budgetRange,
        budgetExplicit,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[enarte] analyze failed", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "تعذر تحليل الصورة",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
