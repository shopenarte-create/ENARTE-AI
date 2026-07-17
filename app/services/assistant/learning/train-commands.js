/**
 * Natural-language training commands.
 *
 * When the trainer is talking to the assistant in train mode, plain messages
 * can be teaching instructions instead of customer questions:
 *   - approve  → keep the last answer for the last question
 *   - correct  → replace the last answer with the trainer's text
 *   - teach    → store an explicit question/answer pair from one sentence
 *
 * Returns null when the message is a normal question (so the trainer can still
 * test the assistant by asking it things).
 */

const APPROVE_PATTERNS = [
  /^(?:اعتمد(?:ه|ها|\s+الجواب)?|احفظ(?:ه|ها|\s+الجواب)?|خزّ?ن(?:ه|ها|\s+الجواب)?|وافق|هذا\s+صحيح|الجواب\s+صحيح|جواب\s+صح|صح\s+الجواب|تمام\s+اعتمد\w*|ثبّ?ت(?:ه|\s+الجواب)?)\s*$/i,
  /^(?:approve|save\s+(?:this|it)(?:\s+answer)?|that'?s\s+correct|keep\s+this|looks?\s+good|correct\s+answer)\s*$/i,
  /^(?:صح|تمام|👍|✅)\s*$/i,
];

const STOP_PATTERNS = [
  /^(?:انتهى|خلص|انهاء|إنهاء|اوقف|أوقف|وقف)\s+(?:وضع\s+)?التدريب\s*[.!؟?]*$/i,
  /^(?:انتهينا|خلصنا)\s+(?:من\s+)?التدريب\s*[.!؟?]*$/i,
  /^(?:training\s+(?:is\s+)?(?:done|finished|over)|end\s+training|stop\s+training)\s*[.!?]*$/i,
];

// Markers after which the remainder of the message is the corrected answer.
const CORRECT_MARKERS = [
  /(?:الجواب\s+الصحيح\s+(?:هو|هي)?)\s*[:：\-]?\s*/i,
  /(?:الإجابة\s+الصحيحة\s+(?:هي|هو)?)\s*[:：\-]?\s*/i,
  /(?:الصحيح\s+(?:هو|هي)?)\s*[:：\-]?\s*/i,
  /(?:الصح\s+(?:هو|هي)?)\s*[:：\-]?\s*/i,
  /(?:لا[،,]?\s+)?(?:الجواب\s+(?:هو|هي))\s*[:：\-]?\s*/i,
  /(?:عدّ?ل\s+الجواب\s+(?:الى|إلى|ل)?)\s*[:：\-]?\s*/i,
  /(?:بدّ?ل\s+الجواب\s+(?:ب|الى|إلى)?)\s*[:：\-]?\s*/i,
  /(?:خلّ?ي\s+الجواب)\s*[:：\-]?\s*/i,
  /(?:المفروض|لازم)\s+تقول\s*[:：\-]?\s*/i,
  /(?:the\s+(?:correct\s+)?answer\s+is)\s*[:：\-]?\s*/i,
  /(?:it\s+should\s+say|you\s+should\s+say)\s*[:：\-]?\s*/i,
  /(?:no[,]?\s+the\s+answer\s+is)\s*[:：\-]?\s*/i,
  /^(?:correct)\s*[:：\-]\s*/i,
];

// Explicit "when asked X, the answer is Y" pair extraction.
const TEACH_PAIR_PATTERNS = [
  /(?:لمّ?ا|إذا|اذا|عندما)\s+(?:حدا\s+|أحد\s+|حد\s+)?(?:يسأل(?:ك|وك|ه)?|سأل(?:ك|وك|ه)?|يستفسر)\s+(?:عن\s+)?(.+?)\s*[،,]?\s*(?:الجواب|الإجابة|جاوب(?:ه)?|قول(?:ه|\s+له)?|رد(?:ه)?)\s*(?:هو|هي)?\s*[:：\-]?\s*(.+)/i,
  /(?:السؤال|سؤال)\s*[:：\-]\s*(.+?)\s*(?:الجواب|الإجابة|جواب)\s*[:：\-]\s*(.+)/i,
  /(?:when\s+(?:someone\s+)?asks?|if\s+(?:someone\s+)?asks?)\s+(.+?)[,]?\s+(?:the\s+)?answer\s+(?:is|should\s+be)\s*[:：\-]?\s*(.+)/i,
  /\bq\s*[:：\-]\s*(.+?)\s*\ba\s*[:：\-]\s*(.+)/i,
];

function clean(text) {
  return String(text || "")
    .replace(/^[\s"“”'،,.:؛-]+/, "")
    .replace(/[\s"“”'،,؛]+$/, "")
    .trim();
}

/**
 * @param {string} rawMessage
 * @returns {{ kind: "approve"|"correct"|"teach"|"stop", answer?: string, question?: string }|null}
 */
export function parseTrainerCommand(rawMessage = "") {
  const message = String(rawMessage || "").trim();
  if (!message) return null;

  for (const pattern of STOP_PATTERNS) {
    if (pattern.test(message)) {
      return { kind: "stop" };
    }
  }

  for (const pattern of APPROVE_PATTERNS) {
    if (pattern.test(message)) {
      return { kind: "approve" };
    }
  }

  for (const pattern of TEACH_PAIR_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1] && match[2]) {
      const question = clean(match[1]);
      const answer = clean(match[2]);
      if (question && answer) {
        return { kind: "teach", question, answer };
      }
    }
  }

  for (const marker of CORRECT_MARKERS) {
    const match = message.match(marker);
    if (match) {
      const answer = clean(message.slice(match.index + match[0].length));
      if (answer) {
        return { kind: "correct", answer };
      }
    }
  }

  return null;
}

export function trainerConfirmation(kind, { answer, question } = {}, locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  if (kind === "stop") {
    return useEn
      ? "Training paused. Everything you taught is saved. When you come back here, training will resume automatically."
      : "تم إيقاف التدريب مؤقتاً. كل ما علّمتني محفوظ. لما ترجع تفتح المساعد من هون، التدريب يكمل تلقائياً.";
  }
  if (kind === "approve") {
    return useEn
      ? "Saved — I'll always use this answer for that question."
      : "تم الحفظ — رح أستخدم هذا الجواب دائماً لهذا السؤال.";
  }
  if (kind === "teach") {
    return useEn
      ? `Got it. When asked «${question}», I'll answer:\n${answer}`
      : `تمام. لما يسألني أحد «${question}»، رح أجاوب:\n${answer}`;
  }
  // correct
  return useEn
    ? `Updated. The answer is now:\n${answer}`
    : `تم التعديل. صار الجواب:\n${answer}`;
}

export function trainerNeedsContext(locale = "ar") {
  const useEn = String(locale || "ar").toLowerCase().startsWith("en");
  return useEn
    ? "Ask me the question first, then tell me the correct answer (or approve it)."
    : "اسألني السؤال أول، بعدين قللي الجواب الصحيح (أو اعتمده).";
}
