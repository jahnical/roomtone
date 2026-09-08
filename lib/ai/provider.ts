import "server-only";

export type AiProviderName = "none" | "ollama" | "openrouter";

interface AiConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embedModel: string | null;
}

/**
 * Ollama and OpenRouter are both OpenAI-compatible over HTTP, so this is
 * one adapter with a swapped base URL/key/model rather than two SDKs.
 * AI_PROVIDER=none (the default) means every function below is a no-op —
 * every caller in lib/ai/insight.ts checks isAiEnabled() first and the UI
 * hides the buttons entirely, so Roomtone works fully offline without
 * this ever being configured.
 */
function getProviderName(): AiProviderName {
  const raw = process.env.AI_PROVIDER;
  return raw === "ollama" || raw === "openrouter" ? raw : "none";
}

function getConfig(): AiConfig | null {
  switch (getProviderName()) {
    case "ollama":
      return {
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        // Ollama's OpenAI-compat endpoint ignores the key but OpenAI-style
        // clients require the Authorization header to be present.
        apiKey: "ollama",
        chatModel: process.env.OLLAMA_CHAT_MODEL || "qwen2.5-coder:3b",
        embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
      };
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return null; // configured provider but missing key — treat as disabled, not a crash
      return {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey,
        chatModel: process.env.OPENROUTER_CHAT_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
        // Free-tier OpenRouter models don't uniformly support embeddings;
        // the embed() path is Ollama-only for now.
        embedModel: null,
      };
    }
    case "none":
      return null;
  }
}

export function isAiEnabled(): boolean {
  return getConfig() !== null;
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

/** Returns null on any failure (unreachable provider, timeout, bad response) — callers treat "no AI answer" as a normal, silent outcome, never a thrown error that could break the Stage. */
export async function chat(messages: ChatMessage[], options?: { maxTokens?: number }): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.chatModel,
        messages,
        max_tokens: options?.maxTokens ?? 300,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Semantic embedding for a piece of text, when the configured provider supports it. Not currently consumed anywhere — lib/insight/text/cluster.ts's TF-IDF clustering is the default and doesn't need this — but exposed as the upgrade path the plan calls for, behind the same isAiEnabled() gate. */
export async function embed(text: string): Promise<number[] | null> {
  const config = getConfig();
  if (!config?.embedModel) return null;

  try {
    const res = await fetch(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.embedModel, input: text }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    return data.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
