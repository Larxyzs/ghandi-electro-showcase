import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Database,
  History,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { CindyChat, CindyAvatar } from "./CindyChat";
import { CindyAgentChat } from "./CindyAgentChat";
import { CindyReview, type CindyImportPayload } from "./CindyReview";
import { CindyBulkReview } from "./CindyBulkReview";
import type { CindyBulkItem, CindyEvent, ResearchedProduct } from "@/lib/cindy-types";
import type { SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";


export type CindyActions = {
  listSessions: () => Promise<
    { id: string; title: string; query: string; events: unknown[]; updated_at: string }[]
  >;
  saveSession: (input: { title: string; query: string; events: unknown[] }) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  importProduct: (payload: CindyImportPayload) => Promise<void>;
  listActions: () => Promise<
    {
      id: string;
      action: string;
      label: string;
      undone_at: string | null;
      created_at: string;
    }[]
  >;
  undoAction: (id: string) => Promise<void>;
  listMemory: () => Promise<
    {
      id: string;
      query: string;
      brand: string;
      model: string;
      hits: number;
      searches_used: number;
      updated_at: string;
    }[]
  >;
  forgetMemory: (id: string) => Promise<void>;
  /** Full-site restore points, so any change can be rolled back. */
  listSnapshots?: () => Promise<
    { id: string; label: string; created_by: string; created_at: string }[]
  >;
  createSnapshot?: (label: string) => Promise<void>;
  restoreSnapshot?: (id: string) => Promise<void>;
  /** Reloads the admin's view of the site after Cindy changed something. */
  refreshSite?: () => Promise<void> | void;
};


export function CindyWorkspace({
  data,
  actions,
  initialQuery,
  defaultNodeId,
}: {
  data: SiteData;
  actions: CindyActions;
  initialQuery?: string;
  defaultNodeId?: string | null;
}) {
  const [chatKey, setChatKey] = useState(0);
  const [result, setResult] = useState<ResearchedProduct | null>(null);
  const [bulk, setBulk] = useState<CindyBulkItem[] | null>(null);
  const [retryQuery, setRetryQuery] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Awaited<ReturnType<CindyActions["listSessions"]>>>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<CindyActions["listActions"]>>>([]);
  const [memory, setMemory] = useState<Awaited<ReturnType<CindyActions["listMemory"]>>>([]);
  const [snapshots, setSnapshots] = useState<
    { id: string; label: string; created_by: string; created_at: string }[]
  >([]);
  const [pane, setPane] = useState<"sessions" | "memory" | "history" | "snapshots">("sessions");
  const [mode, setMode] = useState<"chat" | "research">("chat");
  const [loading, setLoading] = useState(true);
  const [replay, setReplay] = useState<{ query: string; events: CindyEvent[] } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h, m, snaps] = await Promise.all([
        actions.listSessions(),
        actions.listActions(),
        actions.listMemory(),
        actions.listSnapshots?.() ?? Promise.resolve([]),
      ]);
      setSessions(s);
      setHistory(h);
      setMemory(m);
      setSnapshots(snaps);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);


  const onEvents = async (events: CindyEvent[], query: string) => {
    if (events.length === 0) return;
    await actions.saveSession({ title: query, query, events: events as unknown[] });
    void refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1.5">
          {(
            [
              ["chat", "Discussion", MessageSquare],
              ["research", "Recherche produit", Search],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                mode === id ? "bg-brand-soft text-brand-deep" : "text-foreground/60 hover:text-brand",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {mode === "chat" ? (
          <CindyAgentChat
            onChanged={() => {
              void actions.refreshSite?.();
              void refresh();
            }}
          />
        ) : bulk ? (
          <CindyBulkReview
            items={bulk}
            data={data}
            {...(defaultNodeId ? { defaultNodeId } : {})}
            onCancel={() => {
              setBulk(null);
              setChatKey((k) => k + 1);
              void refresh();
            }}
            onImport={async (payload) => {
              await actions.importProduct(payload);
            }}
            onRetry={(refs) => {
              setBulk(null);
              setRetryQuery(refs.join("\n"));
              setChatKey((k) => k + 1);
            }}
          />
        ) : result ? (
          <CindyReview
            product={result}
            data={data}
            {...(defaultNodeId ? { defaultNodeId } : {})}
            onCancel={() => setResult(null)}
            onImport={async (payload) => {
              await actions.importProduct(payload);
              setResult(null);
              setChatKey((k) => k + 1);
              void refresh();
            }}
          />
        ) : (
          <CindyChat
            key={chatKey}
            {...(retryQuery ?? initialQuery ? { initialQuery: retryQuery ?? initialQuery } : {})}
            onResult={setResult}
            onBulk={setBulk}
            onEvents={onEvents}
          />
        )}


        {replay && (
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-sm font-semibold">
                Recherche précédente · {replay.query}
              </p>
              <button
                type="button"
                onClick={() => setReplay(null)}
                className="text-xs font-semibold text-foreground/55 hover:text-brand"
              >
                Fermer
              </button>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-foreground/70">
              {replay.events
                .filter((e) => e.type === "activity" || e.type === "source" || e.type === "message")
                .map((event, index) => (
                  <li key={index} className="truncate">
                    {event.type === "message"
                      ? `Cindy : ${event.text}`
                      : event.type === "activity"
                        ? `${event.label} — ${event.detail ?? ""}`
                        : `Source : ${event.source.domain}`}
                  </li>
                ))}
            </ul>
            {(() => {
              const found = replay.events.find((e) => e.type === "result");
              if (!found || found.type !== "result") return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    setResult(found.product);
                    setReplay(null);
                  }}
                  className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  Revoir le produit
                </button>
              );
            })()}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setReplay(null);
            setBulk(null);
            setRetryQuery(null);
            setChatKey((k) => k + 1);

          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Plus className="h-4 w-4" /> Nouvelle recherche
        </button>

        <div className="rounded-3xl border border-border bg-card p-2">
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                ["sessions", "Recherches", Clock],
                ["memory", "Mémoire", Database],
                ["history", "Historique", History],
                ["snapshots", "Sauvegardes", Save],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPane(id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[11px] font-semibold transition",
                  pane === id ? "bg-brand-soft text-brand" : "text-foreground/60",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-[52vh] space-y-1.5 overflow-y-auto p-1">
            {loading && <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-brand" />}

            {!loading && pane === "sessions" && sessions.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-foreground/50">
                Aucune recherche pour l'instant.
              </p>
            )}

            {!loading &&
              pane === "sessions" &&
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="group flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-brand-soft/40"
                >
                  <CindyAvatar className="h-7 w-7 rounded-xl" />
                  <button
                    type="button"
                    onClick={() =>
                      setReplay({
                        query: session.query || session.title,
                        events: session.events as CindyEvent[],
                      })
                    }
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className="block truncate text-xs font-semibold">{session.title}</span>
                    <span className="block text-[11px] text-foreground/50">
                      {new Date(session.updated_at).toLocaleString("fr-MA")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await actions.deleteSession(session.id);
                      void refresh();
                    }}
                    className="hidden text-foreground/40 hover:text-destructive group-hover:block"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

            {!loading && pane === "memory" && memory.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-foreground/50">
                Aucun produit en mémoire. Chaque recherche y est enregistrée pour ne jamais être
                refaite.
              </p>
            )}

            {!loading &&
              pane === "memory" &&
              memory.map((entry) => (
                <div key={entry.id} className="rounded-xl px-2.5 py-2 hover:bg-brand-soft/40">
                  <p className="truncate text-xs font-semibold">{entry.query}</p>
                  <p className="text-[11px] text-foreground/50">
                    {entry.searches_used} recherche(s) web · réutilisée {entry.hits} fois
                  </p>
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setReplay({ query: entry.query, events: [] })}
                      className="text-[11px] font-semibold text-brand"
                    >
                      Réutiliser
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await actions.forgetMemory(entry.id);
                        void refresh();
                      }}
                      className="text-[11px] font-semibold text-foreground/50 hover:text-destructive"
                    >
                      Oublier
                    </button>
                  </div>
                </div>
              ))}

            {!loading && pane === "history" && history.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-foreground/50">
                Aucune action enregistrée.
              </p>
            )}

            {!loading &&
              pane === "history" &&
              history.map((entry) => (
                <div key={entry.id} className="rounded-xl px-2.5 py-2 hover:bg-brand-soft/40">
                  <p className="truncate text-xs font-semibold">{entry.label}</p>
                  <p className="text-[11px] text-foreground/50">
                    {new Date(entry.created_at).toLocaleString("fr-MA")}
                  </p>
                  {entry.undone_at ? (
                    <p className="mt-1 text-[11px] font-semibold text-foreground/45">Annulée</p>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await actions.undoAction(entry.id);
                        void refresh();
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Annuler
                    </button>
                  )}
                </div>
              ))}

            {!loading && pane === "snapshots" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    await actions.createSnapshot?.(
                      `Sauvegarde manuelle ${new Date().toLocaleString("fr-MA")}`,
                    );
                    void refresh();
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[11px] font-semibold text-brand hover:bg-brand-soft/40"
                >
                  <Save className="h-3.5 w-3.5" /> Sauvegarder l'état actuel
                </button>
                {snapshots.length === 0 && (
                  <p className="px-2 py-4 text-center text-[11px] text-foreground/50">
                    Aucune sauvegarde. Une sauvegarde est créée automatiquement avant chaque
                    modification faite par Cindy.
                  </p>
                )}
                {snapshots.map((snap) => (
                  <div key={snap.id} className="rounded-xl px-2.5 py-2 hover:bg-brand-soft/40">
                    <p className="truncate text-xs font-semibold">{snap.label}</p>
                    <p className="text-[11px] text-foreground/50">
                      {new Date(snap.created_at).toLocaleString("fr-MA")}
                      {snap.created_by ? ` · ${snap.created_by}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Remettre tout le site (dossiers, articles, couleurs, recherches) dans l'état « ${snap.label} » ?`,
                          )
                        )
                          return;
                        await actions.restoreSnapshot?.(snap.id);
                        await actions.refreshSite?.();
                        void refresh();
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </aside>
    </div>
  );
}
