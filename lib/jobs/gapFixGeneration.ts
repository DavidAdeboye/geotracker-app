// Generates the actual content asset meant to close a citation gap.
// Takes a traced gap (from citationTrace.ts) and produces publishable text
// in one of three shapes: a comparison page, an FAQ block, or a
// community-style answer — the three surfaces AI answers most often draw from.

import { callModel, MODEL_FOR_JOB } from "../agentrouter/client";

export type FixType = "comparison_page" | "faq_block" | "reddit_answer";

export interface GapFixInput {
  brandName: string;
  category: string;
  queryCluster: string;
  gapDescription: string | null;
  fixType: FixType;
}

const FIX_TYPE_INSTRUCTIONS: Record<FixType, string> = {
  comparison_page:
    "Write the body copy for a comparison page section (plain text, not JSON or markdown headers with #). " +
    "It should stack the brand against the category's other well-known options on the dimensions someone " +
    "asking this question actually cares about, and state plainly where the brand is and isn't the right fit.",
  faq_block:
    "Write a short FAQ block: 2-4 question-and-answer pairs (format each as 'Q: ...' then 'A: ...') that " +
    "directly answer the query cluster's underlying question, with the brand mentioned only where it's a " +
    "genuinely relevant answer.",
  reddit_answer:
    "Write a single first-person community-forum-style answer (like a knowledgeable Reddit reply) to the " +
    "query cluster's underlying question. Candid, specific, a little opinionated, mentions trade-offs. " +
    "Only bring up the brand if it earns a place in a genuine answer — don't force it.",
};

const SYSTEM_PROMPT = `You write short, specific content assets meant to be published on the open web so that
AI models researching a topic have real material to cite. You are not writing ad copy — an answer that
oversells the brand will not get cited by a model that's trying to give a balanced answer to its user.
Be concrete, be honest about trade-offs, and write like someone who actually knows the category.
Respond with the content only — no preamble, no markdown title, no meta-commentary about the task.`;

export async function generateGapFix(input: GapFixInput): Promise<string> {
  const userPrompt = `Brand: ${input.brandName}
Category: ${input.category}
Query cluster this content should help win: ${input.queryCluster}
${input.gapDescription ? `Known gap: ${input.gapDescription}` : "No specific gap description provided — use the query cluster as your guide."}

Task: ${FIX_TYPE_INSTRUCTIONS[input.fixType]}`;

  const content = await callModel(MODEL_FOR_JOB.gap_fix_generation, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  return content.trim();
}
