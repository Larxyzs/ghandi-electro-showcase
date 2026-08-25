import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchProviderId = "tavily" | "serper" | "brave";

const PROVIDERS: { id: SearchProviderId; label: string; hint: string }[] = [
  { id: "tavily", label: "Tavily", hint: "api.tavily.com — recherche optimisée IA" },
  { id: "serper", label: "Serper (Google)", hint: "google.serper.dev — résultats Google" },
  { id: "brave", label: "Brave Search", hint: "api.search.brave.com" },
];

/** Lets an admin swap Cindy's research API and key, with a live connectivity test. */
export function SearchApiPanel({
  load,
  save,
}: {
  load: () => Promise<{ provider: SearchProviderId; hasKey: boolean; keyPreview: string }>;
  save: (input: { provider: SearchProviderId; key: string | null; test: boolean }) => Promise<{
    test: { ok: boolean; results: number; message: string } | null;
  }>;
}) {
  const [provider, setProvider] = useState<SearchProviderId>("tavily");
  const [preview, setPreview] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void (async () => {
      const settings = await load().catch(() => null);
      if (!settings) return;
      setProvider(settings.provider);
      setPreview(settings.keyPreview);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (test: boolean) => {
    setBusy(true);
    setResult(null);
    try {
      const response = await save({ provider, key: key.trim() || null, test });
      if (response.test) {
        setResult(
          response.test.ok
            ? { ok: true, text: `Connexion réussie (${response.test.results} résultats).` }
            : {
                ok: false,
                text:
                  response.test.message === "SEARCH_KEY_INVALID"
                    ? "Clé refusée par le fournisseur. Vous pouvez revenir en arrière."
                    : `Test échoué : ${response.test.message}`,
              },
        );
      } else {
        setResult({ ok: true, text: "Configuration enregistrée." });
      }
      if (key.trim()) setPreview(`••••${key.trim().slice(-4)}`);
    } catch {
      setResult({ ok: false, text: "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">API de recherche de Cindy</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Choisissez le fournisseur de recherche et collez votre clé. Cindy s'adapte
          automatiquement ; en cas de clé invalide vous pouvez revenir au réglage précédent.
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

        <label className="mt-5 block text-sm font-medium">
          Clé API
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
