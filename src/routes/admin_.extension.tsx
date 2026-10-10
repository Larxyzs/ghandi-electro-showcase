import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy } from "lucide-react";
import { extCreateKey, extListKeys, extRevokeKey } from "@/lib/extension.functions";

export const Route = createFileRoute("/admin_/extension")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Extension Chrome | Ghandi Home Electro" },
      { name: "description", content: "Connecter l'extension Chrome au site." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Extension Chrome | Ghandi Home Electro" },
      { property: "og:description", content: "Espace privé." },
    ],
  }),
  component: ExtensionPage,
});

type Key = { id: string; label: string; created_at: string; last_used_at: string | null; revoked: boolean };

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground">
      <Copy className="h-4 w-4" /> {ok ? "Copié" : "Copier"}
    </button>
  );
}

function ExtensionPage() {
  const list = useServerFn(extListKeys);
  const create = useServerFn(extCreateKey);
  const revoke = useServerFn(extRevokeKey);
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [url, setUrl] = useState("");
  const load = () => list().then(setKeys).catch(() => setError("Connectez-vous d'abord à l'administration."));
  useEffect(() => { setUrl(`${window.location.origin}/api/public/ghandi-import`); void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const box = "rounded-2xl border border-border bg-card p-5";
  return (
    <div className="min-h-screen bg-brand-soft/30">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" /> Retour à l'admin</Link>
        <h1 className="text-2xl font-semibold">Extension Chrome</h1>
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        <div className={box}>
          <p className="text-sm font-semibold">Adresse d'import</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-brand-soft/50 px-3 py-2 text-xs">{url}</code>
            <CopyBtn text={url} />
          </div>
          <p className="mt-2 text-xs text-foreground/55">Utilisez l'adresse de votre site publié (ghandihomeelectro.com) dans l'extension.</p>
        </div>
        <div className={box}>
          <button type="button" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            onClick={async () => { const r = await create({ data: { label: `Clé du ${new Date().toLocaleDateString("fr-FR")}` } }); setNewKey(r.key); void load(); }}>
            Créer une clé secrète
          </button>
          {newKey && (
            <div className="mt-4 rounded-xl border border-brand/40 bg-brand-soft/40 p-3">
              <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs">{newKey}</code><CopyBtn text={newKey} /></div>
              <p className="mt-2 text-xs font-semibold">Collez-la dans l'extension. Elle ne sera plus affichée.</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {(keys ?? []).map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{k.label || "Clé"} {k.revoked && <span className="text-destructive">(révoquée)</span>}</p>
                  <p className="text-xs text-foreground/55">Dernière utilisation : {k.last_used_at ? new Date(k.last_used_at).toLocaleString("fr-FR") : "jamais"}</p>
                </div>
                {!k.revoked && <button type="button" onClick={async () => { await revoke({ data: { id: k.id } }); void load(); }} className="text-xs font-semibold text-destructive">Révoquer</button>}
              </div>
            ))}
          </div>
        </div>
        <div className={box}>
          <p className="text-sm">1. Copiez l'adresse. 2. Copiez la clé. 3. Dans l'extension, cliquez « My site » et collez les deux. 4. Cliquez « Save and test ».</p>
        </div>
      </div>
    </div>
  );
}
