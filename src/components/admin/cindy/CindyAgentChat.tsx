import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowUp, Check, Loader2, Square, Zap } from "lucide-react";
import type { CindyActivityKind, CindyAgentEvent, CindyChatMessage } from "@/lib/cindy-types";
import { CindyAvatar } from "./CindyChat";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  kind: CindyActivityKind;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
};

export type CindyTurn = CindyChatMessage & { activities?: Activity[]; error?: string };
type Turn = CindyTurn;

const isRtl = (text: string) => /[\u0600-\u06ff]/.test(text);

/** Renders Cindy's plain-text answer with simple bullet/line formatting. */
function Answer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div dir={isRtl(text) ? "rtl" : "ltr"} className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        const bullet = /^([-*•]|\d+[.)])\s+/.exec(trimmed);
        if (bullet) {
          return (
            <p key={index} className="flex gap-2">
              <span className="text-brand">•</span>
              <span>{trimmed.slice(bullet[0].length).replace(/\*\*/g, "")}</span>
            </p>
          );
        }
        return <p key={index}>{trimmed.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

export function CindyAgentChat({
  onChanged,
  suggestions,
  initialTurns,
  onTurns,
}: {
  onChanged?: () => void;
  suggestions?: string[];
  /** Restores a previous conversation (persisted server-side). */
  initialTurns?: CindyTurn[];
  /** Called whenever the conversation changes so it can be auto-saved. */
  onTurns?: (turns: CindyTurn[]) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns ?? []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  /** Lets the admin stop Cindy mid-run (long imports, repair retries). */
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, live, activities]);

  useEffect(() => {
    if (!streaming) inputRef.current?.focus();
  }, [streaming]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;
    const history: CindyChatMessage[] = [
      ...turns.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: "user", content: text },
    ];
    let base: Turn[] = [];
    setTurns((prev) => {
      base = [...prev, { role: "user" as const, content: text }];
      onTurns?.(base);
      return base;
    });
    setInput("");
    setStreaming(true);
    setLive("");
    setActivities([]);

    let answer = "";
    const steps: Activity[] = [];
    let failure: string | null = null;
    let changed = false;
    const controller = new AbortController();
    abortRef.current = controller;
    let stopped = false;

    // Cindy can work for minutes. Persist the answer-so-far every few seconds so
    // closing or reloading the tab never leaves an empty conversation behind.
    let lastSave = Date.now();
    const saveProgress = (force = false) => {
      if (!force && Date.now() - lastSave < 4000) return;
      lastSave = Date.now();
      onTurns?.([
        ...base,
        {
          role: "assistant" as const,
          content: answer.trim(),
          ...(steps.length ? { activities: [...steps] } : {}),
        },
      ]);
    };


    try {
      const res = await fetch("/api/admin/cindy-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Session expirée." : "Erreur réseau.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let event: CindyAgentEvent;
          try {
            event = JSON.parse(line.slice(5).trim()) as CindyAgentEvent;
          } catch {
            continue;
          }
          if (event.type === "delta") {
            answer += event.text;
            setLive(answer);
          } else if (event.type === "assistant") {
            answer = event.text;
            setLive(answer);
          } else if (event.type === "activity") {
            const next: Activity = {
              id: event.id,
              kind: event.kind,
              label: event.label,
              ...(event.detail ? { detail: event.detail } : {}),
              status: event.status,
            };
            const at = steps.findIndex((s) => s.id === next.id);
            if (at >= 0) steps[at] = next;
            else steps.push(next);
            setActivities([...steps]);
          } else if (event.type === "changed") {
            changed = true;
          } else if (event.type === "error") {
            failure = event.message;
          }
          saveProgress();
        }
      }
    } catch (error) {
      if (controller.signal.aborted) stopped = true;
      else failure = error instanceof Error ? error.message : "Erreur inconnue.";
    }

    abortRef.current = null;

    setTurns((prev) => {
      const next: Turn[] = [
        ...prev,
        {
          role: "assistant" as const,
          content: answer.trim() || (failure ? "" : stopped ? "Ok, j'arrête là." : "C'est fait."),
          ...(steps.length ? { activities: [...steps] } : {}),
          ...(failure ? { error: failure } : {}),
        },
      ];
      onTurns?.(next);
      return next;
    });
    setLive("");
    setActivities([]);
    setStreaming(false);
    if (changed) onChanged?.();
  };

  const stop = () => abortRef.current?.abort();

  const stepIcon = (status: Activity["status"]) =>
    status === "running" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
    ) : status === "error" ? (
      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
    ) : (
      <Check className="h-3.5 w-3.5 text-brand" />
    );

  const Steps = ({ items }: { items: Activity[] }) => (
    <ul className="mt-3 space-y-1.5 rounded-2xl border border-border bg-background/60 p-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-xs">
          <span className="mt-0.5">{stepIcon(item.status)}</span>
          <span className="min-w-0">
            <span className="font-semibold">{item.label}</span>
            {item.detail && <span className="text-foreground/55"> · {item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <CindyAvatar className="h-10 w-10 rounded-2xl" />
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">Cindy · assistante du site</p>
          <p className="text-xs text-foreground/55">
            Parlez-lui dans votre langue — elle répond dans la même et agit sur tout le site.
          </p>
        </div>
        <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand-deep">
          <Zap className="h-3 w-3" /> Accès complet
        </span>
      </header>

      <div ref={boxRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {turns.length === 0 && !streaming && (
          <div className="space-y-4">
            <p className="text-sm text-foreground/70">
              Dites-lui par exemple : « Crée les produits suivants en Samsung, prix 6990, stock 3 :
              RB34T672EWW, WW90T534DAW… », « Renomme le dossier TV en Téléviseurs », « Mets la
              couleur du site en bleu #0B5FFF », ou écrivez-lui en arabe / anglais.
            </p>
            <div className="flex flex-wrap gap-2">
              {(suggestions ?? [
                "Montre-moi l'état du catalogue",
                "Crée le dossier Climatiseurs / Split / 12000 BTU",
                "Recherche Samsung RB34T672EWW et prépare la fiche",
              ]).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground/70 hover:border-brand/50 hover:text-brand"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, index) =>
          turn.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p
                dir={isRtl(turn.content) ? "rtl" : "ltr"}
                className="max-w-[80%] rounded-3xl rounded-br-lg bg-brand-soft px-4 py-3 text-sm whitespace-pre-wrap text-brand-deep"
              >
                {turn.content}
              </p>
            </div>
          ) : (
            <div key={index} className="flex gap-3">
              <CindyAvatar className="h-8 w-8 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 rounded-3xl rounded-bl-lg border border-border bg-background px-4 py-3">
                {turn.content && <Answer text={turn.content} />}
                {turn.activities && <Steps items={turn.activities} />}
                {turn.error && (
                  <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> {turn.error}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {streaming && (
          <div className="flex gap-3">
            <CindyAvatar className="h-8 w-8 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 rounded-3xl rounded-bl-lg border border-border bg-background px-4 py-3">
              {live ? (
                <Answer text={live} />
              ) : (
                <p className="flex items-center gap-2 text-sm text-foreground/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Cindy réfléchit…
                </p>
              )}
              {activities.length > 0 && <Steps items={activities} />}
              <button
                type="button"
                onClick={stop}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 transition hover:border-destructive/50 hover:text-destructive"
              >
                <Square className="h-3 w-3" /> Arrêter
              </button>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-border p-4"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-background p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            dir={isRtl(input) ? "rtl" : "ltr"}
            placeholder="Écrivez à Cindy — français, English, العربية, Español, Italiano…"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border text-foreground/70 transition hover:border-destructive/50 hover:text-destructive"
              aria-label="Arrêter Cindy"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-primary-foreground transition disabled:opacity-40",
            )}
            style={{ background: "var(--gradient-brand)" }}
            aria-label="Envoyer"
          >
            {streaming ? (
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
