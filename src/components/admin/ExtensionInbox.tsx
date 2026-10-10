import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X } from "lucide-react";
import { extCancelBatch, extListBatches } from "@/lib/extension.functions";
import type { InboxBatch } from "@/lib/extension.server";

export function useBatches(intervalMs = 15000) {
  const list = useServerFn(extListBatches);
  const [batches, setBatches] = useState<InboxBatch[]>([]);
  const reload = () => list().then(setBatches).catch(() => undefined);
  useEffect(() => {
    void reload();
    const t = window.setInterval(() => void reload(), intervalMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { batches, reload };
}

export function BatchActions({ b, onDone }: { b: InboxBatch; onDone: () => void }) {
  const cancel = useServerFn(extCancelBatch);
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      <button type="button" className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:border-destructive hover:text-destructive"
        onClick={async () => {
          if (!window.confirm(`Supprimer ces ${b.product_count} produits importés ? Rien n'a été ajouté au site.`)) return;
          await cancel({ data: { id: b.id } });
          onDone();
        }}>Annuler</button>
      {!b.incomplete && b.status !== "done" && (
        <button type="button" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          onClick={() => void navigate({ to: "/admin/import/inbox/$batchId", params: { batchId: b.id } })}>Ajouter au site</button>
      )}
    </div>
  );
}

/** Admin-only bell + pop-up card for batches sent by the Chrome extension. */
export function ExtensionBell() {
  const { batches, reload } = useBatches();
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<InboxBatch | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const ready = batches.filter((b) => b.status === "ready");
  const waiting = batches.filter((b) => b.status === "ready" || b.incomplete);

  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(ready.map((b) => b.id)); return; }
    const fresh = ready.find((b) => !seen.current!.has(b.id));
    ready.forEach((b) => seen.current!.add(b.id));
    if (fresh) setPopup(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  return (
    <>
      <div className="relative">
        <button type="button" aria-label="Notifications de l'extension" onClick={() => setOpen((v) => !v)}
          className="relative grid h-9 w-9 place-items-center rounded-full border border-border hover:border-brand hover:text-brand">
          <Bell className="h-4 w-4" />
          {ready.length > 0 && <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[0.65rem] font-bold text-primary-foreground">{ready.length}</span>}
        </button>
        {open && (
          <div className="absolute end-0 z-40 mt-2 w-80 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
            <p className="mb-2 text-sm font-semibold">Produits reçus de l'extension</p>
            {waiting.length === 0 && <p className="text-xs text-foreground/55">Rien en attente.</p>}
            <div className="space-y-2">
              {waiting.map((b) => (
                <div key={b.id} className="rounded-xl border border-border p-2.5 text-xs">
                  <p className="font-semibold">{b.label || b.id} {b.incomplete && <span className="text-destructive">(incomplet)</span>}</p>
                  <p className="text-foreground/60">{b.product_count} produits · {b.brands || "—"} · {new Date(b.created_at).toLocaleString("fr-FR")}</p>
                  {b.suggested_section_text && <p className="text-foreground/60">Section : {b.suggested_section_text}</p>}
                  <div className="mt-2"><BatchActions b={b} onDone={() => void reload()} /></div>
                </div>
              ))}
            </div>
            <Link to="/admin/import/inbox" className="mt-2 block text-center text-xs font-semibold text-brand">Voir tous les lots</Link>
          </div>
        )}
      </div>
      {popup && (
        <div className="fixed bottom-4 end-4 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <button type="button" aria-label="Fermer" onClick={() => setPopup(null)} className="absolute end-3 top-3"><X className="h-4 w-4" /></button>
          <p className="pe-5 text-sm font-semibold">📦 {popup.product_count} nouveaux produits importés depuis l'extension — « {popup.label || popup.id} »</p>
          <div className="mt-3"><BatchActions b={popup} onDone={() => { setPopup(null); void reload(); }} /></div>
        </div>
      )}
    </>
  );
}
