// AgentRouter client — direct API calls, no local process required.
// Headers below are the disclosed client identity confirmed working for all 5 models
// (claude-opus-5, claude-opus-4-8, gpt-5.6-sol, glm-5.3, deepseek-v4-flash).

const AGENTROUTER_URL = "https://agentrouter.org/v1/chat/completions";

const AGENTROUTER_HEADERS = {
  "Content-Type": "application/json",
  Originator: "codex_cli_rs",
  "User-Agent": "codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464",
  Version: "0.101.0",
} as const;

export type ModelName =
  | "claude-opus-5"
  | "claude-opus-4-8"
  | "gpt-5.6-sol"
  | "glm-5.3"
  | "deepseek-v4-flash";

// Job type -> model mapping. Adjust as you learn which models actually
// perform best for each step — this is a starting point, not gospel.
export const MODEL_FOR_JOB = {
  bulk_fanout: "deepseek-v4-flash",       // cheap, fast, high volume
  bulk_fanout_alt: "glm-5.3",             // secondary cheap model, spread load
  citation_trace: "claude-opus-5",        // reasoning-heavy: which sources get cited
  gap_fix_generation: "claude-opus-5",    // generate the actual content asset
  gap_fix_alt: "gpt-5.6-sol",             // A/B candidate for generation quality
  verification: "deepseek-v4-flash",      // cheap re-check after publishing a fix
} as const satisfies Record<string, ModelName>;

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: { index: number; message: { role: string; content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Call any of the 5 agentrouter models directly. Throws on non-2xx or
 * malformed response so callers can catch and retry/queue.
 */
export async function callModel(
  model: ModelName,
  messages: ChatMessage[],
  apiKey: string = process.env.AGENTROUTER_API_KEY!
): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing AGENTROUTER_API_KEY");
  }

  const res = await fetch(AGENTROUTER_URL, {
    method: "POST",
    headers: {
      ...AGENTROUTER_HEADERS,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`agentrouter ${model} failed: ${res.status} ${errBody}`);
  }

  // Explicit UTF-8 decode — raw response bytes can otherwise mangle
  // apostrophes/em-dashes when read through default encodings.
  const buf = await res.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buf);
  const data: ChatCompletionResponse = JSON.parse(text);

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`agentrouter ${model} returned no content: ${text}`);
  }
  return content;
}

/** Convenience: single-prompt call (most jobs are one user message, no history). */
export function callModelWithPrompt(model: ModelName, prompt: string, apiKey?: string) {
  return callModel(model, [{ role: "user", content: prompt }], apiKey);
}
