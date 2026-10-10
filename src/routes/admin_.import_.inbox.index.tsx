import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BatchActions, useBatches } from "@/components/admin/ExtensionInbox";

export const Route = createFileRoute("/admin_/import_/inbox/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Boîte de réception de l'extension | Ghandi Home Electro" },
      { name: "description", content: "Lots de produits reçus depuis l'extension Chrome." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Boîte de réception | Ghandi Home Electro" },
      { property: "og:description", content: "Espace privé d'import." },
    ],
  }),
  component: InboxList,
});

const STATUS: Record<string, string> = { ready: "Prêt", receiving: "En réception", done: "Terminé" };

function InboxList() {
  const { batches, reload } = useBatches(10000);
  return (
    <div className="min-h-screen bg-brand-soft/30">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" /> Retour à l'admin</Link>
        <h1 className="text-2xl font-semibold">Lots reçus de l'extension</h1>
        {batches.length === 0 && <p className="text-sm text-foreground/60">Aucun lot pour l'instant (30 derniers jours).</p>}
        <div className="space-y-3">
          {batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="text-sm">
                <p className="font-semibold">{b.label || b.id}</p>
                <p className="text-foreground/60">
                  {b.incomplete ? <span className="text-destructive">Incomplet</span> : STATUS[b.status] ?? b.status} · {b.product_count} produits
                  {b.status === "ready" ? ` (${b.pending} en attente)` : ""} · {b.brands || "—"} · {new Date(b.created_at).toLocaleString("fr-FR")}
                </p>
                {b.suggested_section_text && <p className="text-xs text-foreground/55">Section suggérée : {b.suggested_section_text}</p>}
              </div>
              {b.status !== "done" ? <BatchActions b={b} onDone={() => void reload()} /> : <span className="text-xs font-semibold text-brand">✓ Terminé</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
