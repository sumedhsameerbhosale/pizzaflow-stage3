/**
 * Shared OpenRouter chat-completion caller for all 3 AI features.
 * Centralizes the timeout + error handling so a slow/down OpenRouter
 * API can never hang or crash a request -- every caller gets back a
 * plain {ok, text|reason} result and decides its own fallback (per
 * Stage 1's own risk log: "it must not block the core ordering flow").
 */

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

const DEFAULT_TIMEOUT_MS = 8000;

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  opts?: { timeoutMs?: number }
): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey || !model) {
    return { ok: false, reason: "openrouter_not_configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `openrouter_http_${res.status}` };
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      return { ok: false, reason: "openrouter_empty_response" };
    }

    return { ok: true, text };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "openrouter_timeout"
        : "openrouter_network_error";
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}
