import { useEffect, useState } from "react";
import { CheckCircle2, Brain, KeyRound, Loader2, Search, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchProviderId = "tavily" | "serper" | "brave";
export type AiProviderId = "gemini" | "lovable";

const PROVIDERS: { id: SearchProviderId; label: string; hint: string }[] = [
  { id: "serper", label: "Serper (Google)", hint: "google.serper.dev — résultats Google" },
  { id: "tavily", label: "Tavily", hint: "api.tavily.com — recherche optimisée IA" },
  { id: "brave", label: "Brave Search", hint: "api.search.brave.com" },
];

const SEARCH_MODELS: { id: string; label: string }[] = [
  { id: "search", label: "Web (Google)" },
  { id: "news", label: "Actualités" },
  { id: "shopping", label: "Shopping" },
];

const AI_PROVIDERS: { id: AiProviderId; label: string; hint: string }[] = [
  { id: "gemini", label: "Google Gemini", hint: "clé Gemini directe" },
  { id: "lovable", label: "Lovable AI", hint: "passerelle Lovable (crédits)" },
];

const AI_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
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

export type SearchSettings = {
  provider: SearchProviderId;
  model: string;
  hasKey: boolean;
  keyPreview: string;
  aiProvider: AiProviderId;
  aiModel: string;
  hasAiKey: boolean;
  aiKeyPreview: string;
};

export type SearchSaveInput = {
  provider: SearchProviderId;
  key: string | null;
  model: string;
  aiProvider: AiProviderId;
  aiModel: string;
  aiKey: string | null;
  test: boolean;
};

export type SearchSaveResult = {
  ok?: boolean;
  saved?: boolean;
  test: { ok: boolean; results: number; message: string } | null;
  aiTest?: { ok: boolean; message: string } | null;
};

function humanError(code: string) {
  if (code === "SEARCH_KEY_INVALID" || code === "AI_KEY_INVALID")
    return "Clé refusée par le fournisseur. Vous pouvez revenir en arrière.";
  if (code === "SEARCH_NOT_CONFIGURED" || code === "AI_NOT_CONFIGURED")
    return "Aucune clé disponible pour ce fournisseur.";
  if (code === "AI_CREDITS") return "Crédits épuisés chez ce fournisseur.";
  if (code === "AI_RATE_LIMITED") return "Trop de requêtes, réessayez dans un instant.";
  return code;
}

/** Lets an admin swap Cindy's research API and AI model, with a live connectivity test. */
export function SearchApiPanel({
  load,
  save,
}: {
  load: () => Promise<SearchSettings>;
  save: (input: SearchSaveInput) => Promise<SearchSaveResult>;
}) {
  const [provider, setProvider] = useState<SearchProviderId>("serper");
  const [model, setModel] = useState("search");
  const [preview, setPreview] = useState("");
  const [key, setKey] = useState("");

  const [aiProvider, setAiProvider] = useState<AiProviderId>("gemini");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
  const [aiPreview, setAiPreview] = useState("");
  const [aiKey, setAiKey] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const settings = await load().catch(() => null);
      if (!settings) return;
      setProvider(settings.provider);
      setModel(settings.model || "search");
      setPreview(settings.keyPreview);
      setAiProvider(settings.aiProvider);
      setAiModel(settings.aiModel);
      setAiPreview(settings.aiKeyPreview);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (test: boolean) => {
    setBusy(true);
    setResult(null);
    try {
      const response = await save({
        provider,
        key: key.trim() || null,
        model,
        aiProvider,
        aiModel,
        aiKey: aiKey.trim() || null,
        test,
      });

      const failed =
        (response.test && !response.test.ok) || (response.aiTest && !response.aiTest.ok);
      if (failed) {
        const messages = [
          response.test && !response.test.ok
            ? `Recherche : ${humanError(response.test.message)}`
            : null,
          response.aiTest && !response.aiTest.ok
            ? `IA : ${humanError(response.aiTest.message)}`
            : null,
        ].filter(Boolean);
        setResult({
          ok: false,
          text: `${messages.join(" · ")} — rien n'a été enregistré, l'ancien réglage reste actif.`,
        });
      } else if (response.test || response.aiTest) {
        setResult({
          ok: true,
          text: `Tout fonctionne (${response.test?.results ?? 0} résultats de recherche). Configuration enregistrée.`,
        });
        if (key.trim()) setPreview(`••••${key.trim().slice(-4)}`);
        if (aiKey.trim()) setAiPreview(`••••${aiKey.trim().slice(-4)}`);
        setKey("");
        setAiKey("");
      } else {
        setResult({ ok: true, text: "Configuration enregistrée." });
        if (key.trim()) setPreview(`••••${key.trim().slice(-4)}`);
        if (aiKey.trim()) setAiPreview(`••••${aiKey.trim().slice(-4)}`);
        setKey("");
        setAiKey("");
      }
    } catch {
      setResult({ ok: false, text: "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          <Search className="h-4 w-4 text-brand" /> Recherche produit
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Fournisseur utilisé par Cindy pour trouver les pages officielles. Les clés système
          (Serper / Gemini) sont déjà en place ; collez une clé ici seulement pour la remplacer.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item.id)}
              className={cn(
                "rounded-2xl border p-4 text-start transition",
                provider === item.id
                  ? "border-brand bg-brand-soft/40"
                  : "border-border hover:border-brand/50",
              )}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-foreground/55">{item.hint}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Type de recherche
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={provider !== "serper"}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-50"
            >
              {SEARCH_MODELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Clé API de recherche
            <div className="relative mt-1.5">
              <KeyRound className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={preview ? `Clé actuelle : ${preview}` : "Collez votre clé API"}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-background py-2.5 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          <Brain className="h-4 w-4 text-brand" /> Cerveau de Cindy
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Modèle qui rédige, comprend vos demandes et agit sur le site.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {AI_PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAiProvider(item.id);
                setAiModel(AI_MODELS[item.id][0]!.id);
              }}
              className={cn(
                "rounded-2xl border p-4 text-start transition",
                aiProvider === item.id
                  ? "border-brand bg-brand-soft/40"
                  : "border-border hover:border-brand/50",
              )}
            >
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-foreground/55">{item.hint}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Modèle
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            >
              {AI_MODELS[aiProvider].map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Clé API du modèle
            <div className="relative mt-1.5">
              <KeyRound className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <input
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={aiPreview ? `Clé actuelle : ${aiPreview}` : "Collez votre clé API"}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-background py-2.5 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </div>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Tester et enregistrer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit(false)}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Enregistrer sans tester
          </button>
        </div>

        {result && (
          <div
            className={cn(
              "mt-4 flex items-start gap-2 rounded-2xl border p-4 text-sm",
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>{result.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
