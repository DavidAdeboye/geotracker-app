// After a gap fix is published, re-run the cluster's question against a cheap
// model and check whether the brand now shows up. Deliberately simple: this
// is a fast, frequent re-check, not a repeat of the heavy citation-trace step.

import { callModelWithPrompt, MODEL_FOR_JOB } from "../agentrouter/client";

export interface VerificationInput {
  brandName: string;
  prompt: string;
}

export interface VerificationResult {
  brandAppeared: boolean;
  rawResponse: string;
}

export async function verifyGapFix(input: VerificationInput): Promise<VerificationResult> {
  const rawResponse = await callModelWithPrompt(MODEL_FOR_JOB.verification, input.prompt);
  const brandAppeared = rawResponse.toLowerCase().includes(input.brandName.toLowerCase());

  return { brandAppeared, rawResponse };
}
