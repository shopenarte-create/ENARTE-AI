import { authenticate } from "../shopify.server";

import OpenAI from "openai";
import {
  getBudgetPromptContext,
  getBudgetRange,
  resolveBudgetInput,
  wasBudgetExplicitlySelected,
} from "../services/budget.js";

console.log("API ANALYZE CALLED");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BASE_ANALYSIS_PROMPT = `
أنت خبير تصميم داخلي وإنارة لدى ENARTE.

حلل صورة الغرفة وأجب بالعربية فقط.

اذكر:

1- نوع الغرفة
2- مساحة الغرفة التقريبية
3- ارتفاع السقف التقريبي
4- نمط التصميم
5- الألوان المسيطرة
6- شكل الثريا المناسب
7- القطر المناسب بالسنتيمتر
8- اللون المناسب
9- حرارة الإضاءة المناسبة
10- سبب اختيارك

اجعل الإجابة مرتبة وواضحة.
`.trim();

export async function action({ request }) {
  try {
console.log("1");

const formData = await request.formData();

console.log("2");

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
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

const budgetRange = getBudgetRange(budgetResolved.budgetId);
const budgetExplicit = wasBudgetExplicitlySelected(formData.get("budget"));
const budgetPromptContext = getBudgetPromptContext(budgetResolved.budgetId);
const analysisPrompt = budgetPromptContext
  ? `${BASE_ANALYSIS_PROMPT}\n\n${budgetPromptContext}`
  : BASE_ANALYSIS_PROMPT;

console.log("3");

const bytes = await image.arrayBuffer();

console.log("4");

const buffer = Buffer.from(bytes);

console.log("5");

    const base64 = buffer.toString("base64");
    console.log("6");
//const { admin } = await authenticate.admin(request);
//console.log("ADMIN =", admin);
//const shopifyResponse = await admin.graphql(`
//{
  //products(first: 10) {
   // edges {
    //  node {
       // title
       // handle
       // featuredImage {
       //   url
       // }
     // }
   // }
 // }
//}
//`);

//console.log("Shopify response:");
//console.log(shopifyResponse);
console.log("7");

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: analysisPrompt,
            },
            {
              type: "input_image",
              image_url: `data:${image.type};base64,${base64}`,
            },
          ],
        },
      ],
    });
console.log("8");
    return new Response(
      JSON.stringify({
        success: true,
        result: response.output_text,
        budget: budgetRange.id,
        budgetRange,
        budgetExplicit,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
