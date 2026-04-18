import rawQuestions from "../questions.json";

const OPTION_KEYS = ["A", "B", "C", "D", "E"];
const COMPLEX_STEM_PATTERN = /\b(except|incorrect|false|not true|contraindicated|calculate|most appropriate|best action|priority)\b/i;

function inferDifficulty(questionText, options, hasImage) {
  let score = 0;
  const stemLength = questionText.length;
  const optionCount = Object.keys(options).length;

  if (hasImage) score += 1;
  if (optionCount >= 5) score += 1;
  if (stemLength >= 110) score += 1;
  if (stemLength >= 170) score += 1;
  if (COMPLEX_STEM_PATTERN.test(questionText)) score += 1;

  if (score >= 3) return "hard";
  if (score >= 1) return "moderate";
  return "easy";
}

function normalizeWhitespace(value) {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return normalizeWhitespace(
    value
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u00a0/g, " ")
  ).replace(/^["']+/, "").replace(/["']+$/, "");
}

function normalizeExplanation(value) {
  const explanation = normalizeText(value);
  return explanation.length >= 15 ? explanation : null;
}

function nextUniqueId(baseId, index, usedIds) {
  const seed = normalizeText(baseId) || `q_${String(index + 1).padStart(4, "0")}`;

  if (!usedIds.has(seed)) {
    usedIds.add(seed);
    return seed;
  }

  let suffix = 2;
  while (usedIds.has(`${seed}_${suffix}`)) {
    suffix += 1;
  }

  const uniqueId = `${seed}_${suffix}`;
  usedIds.add(uniqueId);
  return uniqueId;
}

function sanitizeQuestion(rawQuestion, index, usedIds) {
  const options = {};

  OPTION_KEYS.forEach((key) => {
    const value = normalizeText(rawQuestion?.options?.[key]);
    if (value) {
      options[key] = value;
    }
  });

  const answer = OPTION_KEYS.includes(rawQuestion?.answer) && options[rawQuestion.answer]
    ? rawQuestion.answer
    : null;
  const question = normalizeText(rawQuestion?.question) || `Question ${index + 1}`;
  const image = normalizeText(rawQuestion?.image) || null;

  return {
    id: nextUniqueId(rawQuestion?.id, index, usedIds),
    question,
    options,
    answer,
    image,
    explanation: normalizeExplanation(rawQuestion?.explanation),
    topic: normalizeText(rawQuestion?.topic) || null,
    difficulty: normalizeText(rawQuestion?.difficulty) || inferDifficulty(question, options, Boolean(image)),
  };
}

function hashText(text) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

function buildSignature(questions) {
  const material = questions
    .map((question) => `${question.id}|${question.answer ?? ""}|${question.question}`)
    .join("\n");

  return `qb_${questions.length}_${hashText(material)}`;
}

const usedIds = new Set();

export const ALL_QUESTIONS = rawQuestions.map((question, index) =>
  sanitizeQuestion(question, index, usedIds)
);

export const QUESTION_ID_SET = new Set(ALL_QUESTIONS.map((question) => question.id));

export const QUESTION_BANK_SIGNATURE = buildSignature(ALL_QUESTIONS);
