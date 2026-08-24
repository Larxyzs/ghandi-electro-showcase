import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronDown,
  Circle,
  ExternalLink,

  Globe,
  ImageIcon,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import type {
  CindyActivityKind,
  CindyBulkItem,
  CindyEvent,
  CindySource,
  ResearchedProduct,
} from "@/lib/cindy-types";

import { cn } from "@/lib/utils";

type Bubble = { id: number; role: "admin" | "cindy"; text: string };
type Activity = {
  id: string;
  kind: CindyActivityKind;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
};
type Check = { label: string; done: boolean };

const KIND_ICON: Record<CindyActivityKind, typeof Search> = {
  search: Search,
  open: Globe,
  read: Sparkles,
  images: ImageIcon,
  extract: Wand2,
  compare: Sparkles,
  cache: Database,
};

export function CindyAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl text-[oklch(1_0_0)] shadow-[var(--shadow-soft)]",
        className ?? "h-9 w-9",
      )}
      style={{ background: "var(--gradient-brand)" }}
      aria-hidden="true"
    >
      <Sparkles className="h-4 w-4" />
    </span>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const Icon = KIND_ICON[activity.kind];
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="mt-0.5 rounded-xl bg-brand-soft p-2 text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{activity.label}</p>
        {activity.detail && (
          <p className="mt-0.5 truncate text-xs text-foreground/60">{activity.detail}</p>
        )}
      </div>
      <span className="mt-1 text-xs">
        {activity.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
        ) : activity.status === "done" ? (
          <Check className="h-3.5 w-3.5 text-brand" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        )}
      </span>
    </div>
  );
}

function SourceCard({ source }: { source: CindySource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition hover:border-brand"
    >
      <span className="mt-0.5 rounded-xl bg-brand-soft p-2 text-brand">
        {source.official ? <BadgeCheck className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{source.title}</span>
          {source.official && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
              Officiel
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-foreground/55">{source.domain}</span>
        <span className="mt-0.5 block text-xs text-foreground/45">{source.status}</span>
      </span>
      <ExternalLink className="mt-1 h-3.5 w-3.5 text-foreground/35 transition group-hover:text-brand" />
    </a>
  );
}

/** Extract multiple product references from a free-form instruction. */
export function parseReferences(raw: string): string[] {
  return raw
    .split(/[\n;,]+/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/^\s*(cr[eé]e|cr[eé]er|ajoute|ajouter|create|add)\b.*?:/i, "")
        .trim(),
    )
    .filter((line) => line.length >= 4 && /\d/.test(line) && !line.endsWith(":"));
}

export function CindyChat({
  initialQuery,
  onResult,
  onEvents,
  onBulk,
}: {
  initialQuery?: string;
  onResult: (product: ResearchedProduct) => void;
  onEvents?: (events: CindyEvent[], query: string) => void;
  onBulk?: (items: CindyBulkItem[]) => void;
}) {
  const [input, setInput] = useState(initialQuery ?? "");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sources, setSources] = useState<CindySource[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState(true);
  const [cachedHit, setCachedHit] = useState<string | null>(null);
  const [bulkItems, setBulkItems] = useState<CindyBulkItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  const push = (role: Bubble["role"], text: string) =>
    setBubbles((prev) => [...prev, { id: ++counter.current, role, text }]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, activities, sources, checks, bulkItems]);

  const run = async (query: string, force = false, refs?: string[]) => {
    setRunning(true);
    setCachedHit(null);
    setError(null);
    setActivities([]);
    setSources([]);
    setChecks([]);
    setBulkItems([]);
    push("admin", refs && refs.length > 1 ? refs.join("\n") : query);
    if (refs && refs.length > 1)
      push(
        "cindy",
        `Je traite ${refs.length} références l'une après l'autre : mémoire d'abord, sinon une seule recherche officielle par produit.`,
      );
    const collected: CindyEvent[] = [];
    const bulk: CindyBulkItem[] = [];

    try {
      const res = await fetch("/api/admin/cindy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, force, refs: refs ?? [] }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);


      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const apply = (event: CindyEvent) => {
        collected.push(event);
        switch (event.type) {
          case "message":
            push("cindy", event.text);
            break;
          case "activity":
            setActivities((prev) => {
              const next = prev.filter((a) => a.id !== event.id);
              return [
                ...next,
                {
                  id: event.id,
                  kind: event.kind,
                  label: event.label,
                  ...(event.detail ? { detail: event.detail } : {}),
                  status: event.status,
                },
              ];
            });
            break;
          case "source":
            setSources((prev) =>
              prev.some((s) => s.url === event.source.url) ? prev : [...prev, event.source],
            );
            break;
          case "checklist":
            setChecks((prev) => [...prev, { label: event.label, done: event.done }]);
            break;
          case "result":
            if (event.cached) setCachedHit(query);
            onResult(event.product);
            break;
          case "bulk_item": {
            const item = event.item;
            const existing = bulk.findIndex((b) => b.index === item.index);
            if (existing >= 0) bulk[existing] = { ...bulk[existing], ...item };
            else bulk.push(item);
            setBulkItems([...bulk].sort((a, b) => a.index - b.index));
            break;
          }
          case "bulk_summary":
            push(
              "cindy",
              `${event.ok} produit${event.ok > 1 ? "s" : ""} prêt${event.ok > 1 ? "s" : ""}${
                event.failed > 0 ? ` · ⚠ ${event.failed} à revoir` : ""
              }. Vérifiez la liste avant création.`,
            );
            onBulk?.([...bulk].sort((a, b) => a.index - b.index));
            break;
          case "error":
            setError(event.message);
            break;
          default:
            break;
        }

      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            apply(JSON.parse(line.slice(5).trim()) as CindyEvent);
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible");
    } finally {
      setRunning(false);
      onEvents?.(collected, query);
    }
  };

  const suggestions = useMemo(
    () => ["Samsung RB34T672EWW", "LG GC-B459", "Bosch KGN39VLEB", "TCL 55C645"],
    [],
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = input.trim();
    if (!raw || running) return;
    setInput("");
    // "recherche à nouveau", "refais la recherche", "re-research"… force a fresh pass.
    const force = /(à|a) nouveau|nouveau la recherche|refai|refaire|re-?cherche.? de nouveau|re-?research|force/i.test(
      raw,
    );
    const refs = parseReferences(raw);
    if (refs.length > 1) {
      void run(refs[0]!, force, refs);
      return;
    }
    const query = raw
      .replace(/\b(recherche|rechercher|refais|refaire|cherche|find|research)\b/gi, " ")
      .replace(/\b((à|a) nouveau|de nouveau|encore|stp|s'il te pla(î|i)t|pour moi)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    void run(query.length >= 2 ? query : raw, force);
  };


  return (
    <div className="flex h-[min(78vh,760px)] flex-col overflow-hidden rounded-3xl border border-border bg-background">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <CindyAvatar />
        <div>
          <p className="font-display text-sm font-semibold">Cindy</p>
          <p className="text-xs text-foreground/55">
            {running ? "Recherche en cours…" : "Assistante de recherche produit"}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
        {bubbles.length === 0 && (
          <div className="mx-auto max-w-md py-10 text-center">
            <CindyAvatar className="mx-auto h-12 w-12" />
            <h3 className="font-display mt-4 text-lg font-semibold">Bonjour 👋</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/60">
              Donnez-moi une référence d'appareil et je rassemble les informations officielles du
              produit : caractéristiques, spécifications, images et sources.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void run(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-brand hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={cn("flex gap-3", bubble.role === "admin" ? "justify-end" : "")}
          >
            {bubble.role === "cindy" && <CindyAvatar className="h-8 w-8" />}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                bubble.role === "admin"
                  ? "bg-brand text-primary-foreground"
                  : "border border-border bg-card",
              )}
            >
              {bubble.text}
            </div>
          </div>
        ))}

        {activities.length > 0 && (
          <div className="ms-11 rounded-3xl border border-border bg-brand-soft/25 p-4">
            <button
              type="button"
              onClick={() => setOpenActivity((v) => !v)}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="text-xs font-semibold tracking-wide text-foreground/60 uppercase">
                Activité de recherche
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition", openActivity ? "rotate-180" : "")}
              />
            </button>
            {openActivity && (
              <div className="mt-3 space-y-2">
                {activities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        )}

        {sources.length > 0 && (
          <div className="ms-11 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-foreground/60 uppercase">
              Sources
            </p>
            {sources.map((source) => (
              <SourceCard key={source.url} source={source} />
            ))}
          </div>
        )}

        {checks.length > 0 && (
          <div className="ms-11 rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold tracking-wide text-foreground/60 uppercase">
              Informations extraites
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {checks.map((check, i) => (
                <li key={`${check.label}-${i}`} className="flex items-center gap-2 text-sm">
                  {check.done ? (
                    <Check className="h-3.5 w-3.5 text-brand" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-foreground/35" />
                  )}
                  <span className={check.done ? "" : "text-foreground/45"}>{check.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cachedHit && (
          <div className="ms-11 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft/40 px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-brand" />
              Fiche réutilisée depuis la mémoire de Cindy — aucune recherche web.
            </span>
            <button
              type="button"
              onClick={() => void run(cachedHit, true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-primary-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Rechercher à nouveau
            </button>
          </div>
        )}

        {bulkItems.length > 0 && (
          <div className="ms-11 rounded-3xl border border-border bg-card p-4">
            <p className="text-xs font-semibold tracking-wide text-foreground/60 uppercase">
              Traitement groupé · {bulkItems.filter((i) => i.status === "done").length}/
              {bulkItems.length}
            </p>
            <ul className="mt-3 space-y-1.5">
              {bulkItems.map((item) => (
                <li key={item.index} className="flex items-center gap-2 text-sm">
                  {item.status === "done" ? (
                    <Check className="h-3.5 w-3.5 text-brand" />
                  ) : item.status === "running" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  ) : item.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Circle className="h-3 w-3 text-foreground/30" />
                  )}
                  <span className={item.status === "pending" ? "text-foreground/45" : ""}>
                    {item.ref}
                  </span>
                  {item.cached && <Database className="h-3 w-3 text-brand" />}
                  {item.message && (
                    <span className="truncate text-xs text-destructive">{item.message}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="ms-11 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border p-4">
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-4 py-2 focus-within:border-brand">
          <Search className="mb-2 h-4 w-4 shrink-0 text-foreground/40" />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={input.includes("\n") ? 4 : 1}
            placeholder="Une référence, ou plusieurs (une par ligne) pour une création groupée"
            className="flex-1 resize-none bg-transparent py-2 text-sm outline-none"
            disabled={running}
          />

          <button
            type="submit"
            disabled={running || input.trim().length < 2}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
            style={{ background: "var(--gradient-brand)" }}
            aria-label="Lancer la recherche"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
