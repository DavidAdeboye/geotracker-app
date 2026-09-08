// Runs a batch of query-cluster prompts concurrently against cheap models.
// This is the high-volume path — no local process, plain HTTP, scales horizontally.

import { callModelWithPrompt, MODEL_FOR_JOB } from "../agentrouter/client";

export interface QueryClusterJob {
  id: string;
  brandId: string;
  prompt: string;
}

export interface QueryClusterResult {
  id: string;
  brandId: string;
  prompt: string;
  response: string | null;
  error: string | null;
}

/**
 * Runs prompts concurrently, capped at `concurrency` in-flight requests at once.
 * Alternates between two cheap models (deepseek / glm) to spread load and avoid
 * any single-provider rate limit becoming a bottleneck.
 */
export async function runBulkFanOut(
  jobs: QueryClusterJob[],
  concurrency = 8
): Promise<QueryClusterResult[]> {
  const results: QueryClusterResult[] = new Array(jobs.length);
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor++;
      const job = jobs[index];
      const model = index % 2 === 0 ? MODEL_FOR_JOB.bulk_fanout : MODEL_FOR_JOB.bulk_fanout_alt;

      try {
        const response = await callModelWithPrompt(model, job.prompt);
        results[index] = { id: job.id, brandId: job.brandId, prompt: job.prompt, response, error: null };
      } catch (err) {
        results[index] = {
          id: job.id,
          brandId: job.brandId,
          prompt: job.prompt,
          response: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
