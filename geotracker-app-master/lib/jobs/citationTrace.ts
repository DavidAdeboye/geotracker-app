// Heavy reasoning step: given a query cluster's raw AI responses, figure out
// WHICH sources are likely being cited/pulled from, and where the brand has
// zero footprint. This is the differentiator over plain mention-counting.

import { callModel, MODEL_FOR_JOB } from "../agentrouter/client";

export interface CitationTraceInput {
  brandName: string;
  queryCluster: string;
  rawResponses: string[]; // outputs from the bulk fan-out step for this cluster
}

export interface CitationTraceResult {
  likelySources: string[];      // e.g. "G2 reviews", "Reddit r/SaaS thread", "official docs"
  brandFootprint: "strong" | "weak" | "absent";
  gapDescription: string | null; // null if footprint is strong, else what's missing
}

const SYSTEM_PROMPT = `You are analyzing AI-generated responses about a product category to reverse-engineer
which underlying sources (review sites, forums, docs, comparison articles, etc.) likely informed them,
and whether a specific brand has meaningful presence in that source landscape.

Respond ONLY with valid JSON matching this shape, no preamble, no markdown fences:
{
  "likelySources": string[],
  "brandFootprint": "strong" | "weak" | "absent",
  "gapDescription": string | null
}`;

export async function traceCitations(input: CitationTraceInput): Promise<CitationTraceResult> {
  const userPrompt = `Brand: ${input.brandName}
Query cluster: ${input.queryCluster}

Raw AI responses to analyze:
${input.rawResponses.map((r, i) => `--- Response ${i + 1} ---\n${r}`).join("\n\n")}`;

  const raw = await callModel(MODEL_FOR_JOB.citation_trace, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  try {
    // Strip stray markdown fences in case the model adds them despite instructions.
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as CitationTraceResult;
  } catch {
    throw new Error(`citation trace returned unparseable JSON: ${raw}`);
  }
}
