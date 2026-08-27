/**
 * Central AI + research provider configuration.
 *
 * Both are admin-configurable (site_settings) with environment fallbacks:
 *  - research: Serper (default, SERPER_API_KEY) / Tavily / Brave
 *  - Cindy's brain: Gemini (default, GEMINI_API_KEY) or the Lovable AI gateway
 */

export type AiProviderId = "gemini" | "lovable";

export const AI_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (rapide)" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (économique)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (qualité)" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  lovable: [
    { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol" },
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (gateway)" },
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
