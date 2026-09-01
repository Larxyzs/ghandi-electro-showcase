import { createServerFn } from "@tanstack/react-start";

/**
 * Machine translation for catalogue content that lives in the database
 * (category / folder names, product names, characteristics, specifications).
 *
 * Everything is written in French by the store, so the source language is
 * always French. Results are cached forever in `content_translations`, so each
 * distinct sentence is translated once for the whole site.
 */

const LANGS = ["en", "ar", "es", "it"] as const;
type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  ar: "Arabic",
  es: "Spanish",
  it: "Italian",
};

/** Stable short hash (djb2) used as the cache key for a source string. */
export function textHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + "-" + value.length.toString(36);
}

type Input = { lang: string; texts: string[] };

function parseInput(data: unknown): Input {
  const raw = (data ?? {}) as Record<string, unknown>;
  const lang = String(raw["lang"] ?? "");
  const texts = Array.isArray(raw["texts"])
    ? raw["texts"].map((t) => String(t)).filter((t) => t.trim() !== "")
    : [];
  return { lang, texts: texts.slice(0, 120) };
}

export const translateContent = createServerFn({ method: "POST" })
  .inputValidator(parseInput)
  .handler(async ({ data }): Promise<{ translations: Record<string, string> }> => {
    const lang = data.lang as Lang;
    if (!LANGS.includes(lang) || data.texts.length === 0) return { translations: {} };

    const unique = Array.from(new Set(data.texts.map((t) => t.trim()))).filter(Boolean);
    const out: Record<string, string> = {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const byHash = new Map(unique.map((text) => [textHash(text), text]));

    const { data: cached } = await supabaseAdmin
      .from("content_translations")
      .select("source_hash, translated")
      .eq("lang", lang)
      .in("source_hash", Array.from(byHash.keys()));

    for (const row of cached ?? []) {
      const source = byHash.get(row.source_hash as string);
      if (source) {
        out[source] = row.translated as string;
        byHash.delete(row.source_hash as string);
      }
    }

    const missing = Array.from(byHash.values());
    if (missing.length === 0) return { translations: out };

    let translated: string[] = [];
    try {
      const { aiSetup, aiFetchWithRetry } = await import("./ai-config.server");
      const ai = await aiSetup();
      const res = await aiFetchWithRetry(
        ai.url,
        {
          method: "POST",
          headers: ai.headers,
          body: JSON.stringify({
            model: ai.model,
            messages: [
              {
                role: "system",
                content: [
                  `You translate e-commerce catalogue strings from French to ${LANG_NAMES[lang]}.`,
                  "Rules: keep brand names, model references, part numbers, units and measurements exactly as-is.",
                  "Translate only the natural-language words. Keep the same punctuation and line breaks.",
                  "Answer with JSON only: {\"items\":[\"...\"]} — same length and same order as the input array.",
                ].join(" "),
              },
              { role: "user", content: JSON.stringify({ items: missing }) },
            ],
            response_format: { type: "json_object" },
            temperature: 0,
          }),
        },
        { attempts: 3 },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = json.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content) as { items?: unknown };
        if (Array.isArray(parsed.items)) translated = parsed.items.map((t) => String(t));
      }
    } catch {
      /* translation stays untouched — the French text is shown instead */
    }

    if (translated.length !== missing.length) return { translations: out };

    const rows = missing.map((source, i) => ({
      lang,
      source_hash: textHash(source),
      source,
      translated: translated[i]!,
    }));
    for (const row of rows) out[row.source] = row.translated;

    await supabaseAdmin
      .from("content_translations")
      .upsert(rows, { onConflict: "lang,source_hash" });

    return { translations: out };
  });
