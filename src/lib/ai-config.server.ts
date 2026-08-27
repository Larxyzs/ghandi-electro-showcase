/**
 * Central AI + research provider configuration.
 *
 * Both are admin-configurable (site_settings) with environment fallbacks:
 *  - research: Serper (default, SERPER_API_KEY) / Tavily / Brave
 *  - Cindy's brain: Gemini (default, GEMINI_API_KEY) or the Lovable AI gateway
 */

export type AiProviderId = "gemini" | "lovable";

export const AI_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  // Direct Gemini API (clé GEMINI_API_KEY) — toute la famille Gemini.
  gemini: [
    { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash (dernière génération)" },
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview, qualité max)" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (le plus économique)" },
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (preview)" },
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (qualité)" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (rapide)" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (économique)" },
    { id: "gemini-flash-latest", label: "Gemini Flash (toujours la dernière)" },
    { id: "gemini-flash-lite-latest", label: "Gemini Flash Lite (toujours la dernière)" },
    { id: "gemini-pro-latest", label: "Gemini Pro (toujours la dernière)" },
    { id: "gemini-omni-1.1-flash", label: "Gemini Omni 1.1 Flash" },
    { id: "gemma-4-31b-it", label: "Gemma 4 31B (open)" },
    { id: "gemma-4-26b-a4b-it", label: "Gemma 4 26B (open)" },
  ],
  // Passerelle Lovable (crédits) — ids exacts du catalogue.
  lovable: [
    { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash (gateway)" },
    { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash (gateway)" },
    { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash (gateway)" },
    { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro preview (gateway)" },
    { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (gateway)" },
    { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash preview (gateway)" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (gateway)" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (gateway)" },
    { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (gateway)" },
    { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { id: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { id: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna" },
    { id: "openai/gpt-5.5", label: "GPT-5.5" },
    { id: "openai/gpt-5.4", label: "GPT-5.4" },
    { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
  ],
};

export const SEARCH_MODELS: { id: string; label: string }[] = [
  { id: "search", label: "Web (Google)" },
  { id: "news", label: "Actualités" },
  { id: "shopping", label: "Shopping" },
];

export type AiSetup = {
  provider: AiProviderId;
  model: string;
  key: string;
  url: string;
  headers: Record<string, string>;
};

/** Resolves the chat-completions endpoint Cindy should use right now. */
export async function aiSetup(): Promise<AiSetup> {
  let provider: AiProviderId = "gemini";
  let model = "";
  let key = "";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("ai_provider, ai_model, ai_api_key")
      .eq("id", "default")
      .maybeSingle();
    const stored = (data?.ai_provider ?? "gemini") as AiProviderId;
    if (stored === "gemini" || stored === "lovable") provider = stored;
    model = (data?.ai_model ?? "").trim();
    key = (data?.ai_api_key ?? "").trim();
  } catch {
    /* fall back to env */
  }

  if (!key) {
    key = (
      provider === "gemini" ? (process.env["GEMINI_API_KEY"] ?? "") : (process.env["LOVABLE_API_KEY"] ?? "")
    ).trim();
  }
  if (!key && provider === "gemini") {
    const fallback = (process.env["LOVABLE_API_KEY"] ?? "").trim();
    if (fallback) {
      provider = "lovable";
      key = fallback;
      model = "";
    }
  }
  if (!key) throw new Error("AI_NOT_CONFIGURED");

  const known = AI_MODELS[provider].map((m) => m.id);
  if (!model || !known.includes(model)) model = known[0]!;

  return provider === "gemini"
    ? {
        provider,
        model,
        key,
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      }
    : {
        provider,
        model,
        key,
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
      };
}

/** Maps upstream HTTP failures to the error codes the UI already understands. */
export async function aiFailure(res: Response) {
  const text = await res.text().catch(() => "");
  if (res.status === 401 || res.status === 403) return new Error("AI_KEY_INVALID");
  if (res.status === 429) return new Error("AI_RATE_LIMITED");
  if (res.status === 402) return new Error("AI_CREDITS");
  return new Error(`AI_FAILED: ${res.status} ${text.slice(0, 200)}`);
}

/**
 * Calls the AI endpoint and, when rate limited (429) or hit by a transient
 * upstream error (5xx), waits (Retry-After when provided, else exponential
 * backoff with jitter) and resumes automatically.
 */
export async function aiFetchWithRetry(
  url: string,
  init: RequestInit,
  options: {
    attempts?: number;
    signal?: AbortSignal;
    onWait?: (info: { attempt: number; waitMs: number; status: number }) => void;
  } = {},
): Promise<Response> {
  const attempts = options.attempts ?? 5;
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= attempts) return res;

    const header = res.headers.get("retry-after");
    const headerMs = header ? Number(header) * 1000 : NaN;
    const waitMs = Number.isFinite(headerMs) && headerMs > 0
      ? Math.min(headerMs, 60_000)
      : Math.min(2 ** attempt * 1000, 30_000) + Math.floor(Math.random() * 750);

    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    options.onWait?.({ attempt, waitMs, status: res.status });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        options.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, waitMs);
      function onAbort() {
        clearTimeout(timer);
        reject(new Error("ABORTED"));
      }
      if (options.signal?.aborted) onAbort();
      else options.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}


/** Quick connectivity probe used by the admin panel before saving a key. */
export async function testAiProvider(provider: AiProviderId, model: string, key: string) {
  const url =
    provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const headers: Record<string, string> =
    provider === "gemini"
      ? { "Content-Type": "application/json", Authorization: `Bearer ${key}` }
      : { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model || AI_MODELS[provider][0]!.id,
        messages: [{ role: "user", content: "Réponds uniquement: ok" }],
      }),
    });
    if (!res.ok) {
      const error = await aiFailure(res);
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "AI_FAILED" };
  }
}
