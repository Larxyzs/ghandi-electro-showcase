import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Loader2, Upload } from "lucide-react";
import { adminGetData, adminStatus } from "@/lib/admin.functions";
import { adminBulkImport, adminBulkPreview } from "@/lib/bulk-import.functions";
import {
  parseBulkFile,
  type BulkItem,
  type BulkOptions,
  type BulkRowResult,
  type PreviewRow,
} from "@/lib/bulk-import-types";
import { pathOf, type CatalogNode } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin_/import")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Importer des produits | Ghandi Home Electro" },
      { name: "description", content: "Import en masse de produits depuis un fichier JSON." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Importer des produits | Ghandi Home Electro" },
      { property: "og:description", content: "Espace privé d'import de produits." },
    ],
  }),
  component: ImportPage,
});

const BATCH = 10;

function FolderPicker({
  nodes,
  value,
  onChange,
  placeholder,
}: {
  nodes: CatalogNode[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const options = useMemo(
    () =>
      nodes
        .filter((n) => n.level >= 3)
        .map((n) => ({ id: n.id, label: pathOf(nodes, n.id).map((p) => p.name).join(" › ") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes],
  );
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const current = options.find((o) => o.id === value);
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className={cn("font-medium", !current && "text-foreground/50")}>
          {current?.label ?? placeholder}
        </span>
        {current && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-destructive">
            Retirer
          </button>
        )}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un dossier…"
        className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
      />
      <div className="mt-2 max-h-48 overflow-y-auto">
        {shown.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "block w-full rounded-lg px-3 py-1.5 text-start text-sm hover:bg-brand-soft",
              o.id === value && "bg-brand text-primary-foreground hover:bg-brand",
            )}
          >
            {o.label}
          </button>
        ))}
        {shown.length === 0 && <p className="px-3 py-2 text-sm text-foreground/50">Aucun dossier</p>}
      </div>
    </div>
  );
}

function ImportPage() {
  const status = useServerFn(adminStatus);
  const getData = useServerFn(adminGetData);
  const preview = useServerFn(adminBulkPreview);
  const runBatch = useServerFn(adminBulkImport);

  const [auth, setAuth] = useState<boolean | null>(null);
  const [nodes, setNodes] = useState<CatalogNode[]>([]);
  const [paste, setPaste] = useState("");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [failed, setFailed] = useState<{ sourceUrl: string; error: string }[]>([]);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<Record<string, PreviewRow>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | PreviewRow["status"]>("all");
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Record<string, BulkRowResult>>({});
  const [opts, setOpts] = useState<BulkOptions>({
    mode: "skip",
    folderId: null,
    fallbackId: null,
    createMissing: false,
    copyImages: true,
    dropForeignPrice: false,
  });

  useEffect(() => {
    void status().then((s) => {
      setAuth(s.authenticated);
      if (s.authenticated) void getData().then((d) => setNodes(d.nodes));
    });
  }, [status, getData]);

  const load = (text: string) => {
    try {
      const parsed = parseBulkFile(text);
      setItems(parsed.items);
      setFailed(parsed.failed);
      setSelected(new Set(parsed.items.map((i) => i.key)));
      setRows({});
      setResults({});
      setParseError("");
    } catch {
      setParseError("Ce n'est pas un fichier JSON valide.");
    }
  };

  const check = async () => {
    setChecking(true);
    try {
      const out = await preview({ data: { items, options: opts } });
      setRows(Object.fromEntries(out.map((r) => [r.key, r])));
    } finally {
      setChecking(false);
    }
  };

  // re-check when folder settings change
  useEffect(() => {
    if (items.length) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, opts.folderId, opts.fallbackId, opts.createMissing]);

  const start = async (keys: string[]) => {
    setRunning(true);
    setDone(0);
    const todo = items.filter((i) => keys.includes(i.key));
    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      try {
        const out = await runBatch({ data: { items: chunk, options: opts } });
        setResults((prev) => ({ ...prev, ...Object.fromEntries(out.map((r) => [r.key, r])) }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur";
        setResults((prev) => ({
          ...prev,
          ...Object.fromEntries(chunk.map((c) => [c.key, { key: c.key, outcome: "problem", error: msg }])),
        }));
      }
      setDone((d) => d + chunk.length);
    }
    setRunning(false);
    void check();
  };

  const stats = {
    noPrice: items.filter((i) => i.priceValue === null).length,
    noImage: items.filter((i) => i.images.length === 0).length,
    noCategory: items.filter((i) => !i.category).length,
    review: items.filter((i) => i.needsReview).length,
    foreign: items.filter((i) => i.currency && i.currency !== "MAD").length,
  };
  const resList = Object.values(results);
  const count = (o: BulkRowResult["outcome"]) => resList.filter((r) => r.outcome === o).length;
  const problems = resList.filter((r) => r.outcome === "problem");

  const visible = items.filter((i) => {
    const st = rows[i.key]?.status;
    if (filter !== "all" && st !== filter) return false;
    const hay = `${i.name} ${i.brand} ${i.model} ${i.category}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      "name,brand,model,source_url,result,error,warnings",
      ...items
        .filter((i) => results[i.key])
        .map((i) => {
          const r = results[i.key]!;
          return [i.name, i.brand, i.model, i.sourceUrl, r.outcome, r.error ?? "", (r.warnings ?? []).join(" | ")]
            .map(esc)
            .join(",");
        }),
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rapport-import.csv";
    a.click();
  };

  if (auth === null)
    return <Loader2 className="mx-auto mt-24 h-6 w-6 animate-spin text-brand" />;
  if (!auth)
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <p>Connectez-vous d'abord à l'administration.</p>
        <Link to="/admin" className="mt-4 inline-block font-semibold text-brand">Aller à l'admin</Link>
      </div>
    );

  const box = "rounded-3xl border border-border bg-card p-6";
  const chip = (on: boolean) =>
    cn("rounded-full border px-4 py-2 text-sm font-semibold", on ? "border-brand bg-brand text-primary-foreground" : "border-border");
  const selectedKeys = items.filter((i) => selected.has(i.key) && rows[i.key]?.status !== "problem").map((i) => i.key);

  return (
    <div className="min-h-screen bg-brand-soft/30">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <ArrowLeft className="h-4 w-4" /> Retour à l'admin
        </Link>
        <h1 className="text-2xl font-semibold">Importer des produits</h1>

        <div className={box}>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void f.text().then(load);
            }}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/40 p-10 text-center"
          >
            <Upload className="h-8 w-8 text-brand" />
            <span className="font-semibold">Déposez le fichier .json ici (ou cliquez)</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void f.text().then(load);
              }}
            />
          </label>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="…ou collez le JSON ici"
            className="mt-4 h-28 w-full rounded-xl border border-border p-3 font-mono text-xs"
          />
          <button type="button" onClick={() => load(paste)} disabled={!paste.trim()} className={chip(false)}>
            Lire le JSON collé
          </button>
          {parseError && <p className="mt-2 text-sm text-destructive">{parseError}</p>}
        </div>

        {items.length > 0 && (
          <>
            <div className={box}>
              <h2 className="font-semibold">Vérification du fichier</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <Stat label="Produits" v={items.length} />
                <Stat label="Sans prix" v={stats.noPrice} />
                <Stat label="Sans photo" v={stats.noImage} />
                <Stat label="Sans catégorie" v={stats.noCategory} />
                <Stat label="À vérifier" v={stats.review} />
              </div>
              {failed.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold">{failed.length} liens non lus par l'outil</summary>
                  <ul className="mt-2 space-y-1">
                    {failed.map((f, i) => (
                      <li key={i} className="break-all text-foreground/70">{f.sourceUrl} — {f.error}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className={cn(box, "space-y-5")}>
              <h2 className="font-semibold">Réglages</h2>
              <div>
                <p className="mb-2 text-sm font-medium">Mettre TOUS les produits dans ce dossier (optionnel)</p>
                <FolderPicker nodes={nodes} value={opts.folderId} onChange={(id) => setOpts({ ...opts, folderId: id })} placeholder="Utiliser la catégorie du fichier" />
              </div>
              {!opts.folderId && (
                <div>
                  <p className="mb-2 text-sm font-medium">Dossier pour les produits sans catégorie</p>
                  <FolderPicker nodes={nodes} value={opts.fallbackId} onChange={(id) => setOpts({ ...opts, fallbackId: id })} placeholder="Aucun" />
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={opts.createMissing} onChange={(e) => setOpts({ ...opts, createMissing: e.target.checked })} />
                    Créer automatiquement les catégories manquantes (à côté du dossier ci-dessus)
                  </label>
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-medium">Si le produit existe déjà (même lien ou même marque + modèle)</p>
                <div className="flex flex-wrap gap-2">
                  {([["skip", "Ignorer"], ["empty", "Compléter les champs vides"], ["all", "Tout remplacer"]] as const).map(([m, l]) => (
                    <button key={m} type="button" className={chip(opts.mode === m)} onClick={() => setOpts({ ...opts, mode: m })}>{l}</button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={opts.copyImages} onChange={(e) => setOpts({ ...opts, copyImages: e.target.checked })} />
                Copier les photos dans mon stockage
              </label>
              {stats.foreign > 0 && (
                <div className="rounded-xl border border-yellow-400 bg-yellow-50 p-3 text-sm">
                  {stats.foreign} produit(s) ont un prix dans une autre devise que le MAD.
                  <label className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={opts.dropForeignPrice} onChange={(e) => setOpts({ ...opts, dropForeignPrice: e.target.checked })} />
                    Laisser le prix vide pour ceux-là
                  </label>
                </div>
              )}
            </div>

            <div className={box}>
              <div className="flex flex-wrap items-center gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="flex-1 rounded-full border border-border px-4 py-2 text-sm" />
                {([["all", "Tous"], ["new", "Nouveaux"], ["exists", "Existants"], ["problem", "Problèmes"]] as const).map(([f, l]) => (
                  <button key={f} type="button" className={chip(filter === f)} onClick={() => setFilter(f)}>{l}</button>
                ))}
                {checking && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-start text-foreground/60">
                    <tr>
                      <th className="p-2">
                        <input type="checkbox" checked={visible.every((v) => selected.has(v.key))} onChange={(e) => {
                          const next = new Set(selected);
                          visible.forEach((v) => (e.target.checked ? next.add(v.key) : next.delete(v.key)));
                          setSelected(next);
                        }} />
                      </th>
                      <th className="p-2"></th><th className="p-2 text-start">Nom</th><th className="p-2 text-start">Marque</th>
                      <th className="p-2 text-start">Modèle</th><th className="p-2 text-start">Catégorie</th><th className="p-2 text-start">Prix</th><th className="p-2 text-start">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((i) => {
                      const r = rows[i.key];
                      const res = results[i.key];
                      return (
                        <tr key={i.key} className="border-t border-border">
                          <td className="p-2"><input type="checkbox" checked={selected.has(i.key)} onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(i.key); else next.delete(i.key);
                            setSelected(next);
                          }} /></td>
                          <td className="p-2">{i.images[0] ? <img src={i.images[0]} alt="" className="h-10 w-10 rounded object-contain" /> : "—"}</td>
                          <td className="p-2">{i.name}</td><td className="p-2">{i.brand}</td><td className="p-2">{i.model}</td>
                          <td className="p-2">{i.category || "—"}</td>
                          <td className="p-2">{i.priceValue === null ? "—" : `${i.priceValue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${i.currency}`}</td>
                          <td className="p-2">
                            {res ? (
                              <span className={res.outcome === "problem" ? "text-destructive" : "text-brand"}>
                                {{ created: "Créé", updated: "Mis à jour", skipped: "Ignoré", problem: "Problème" }[res.outcome]}
                                {res.error ? ` : ${res.error}` : ""}{res.warnings?.length ? " ⚠" : ""}
                              </span>
                            ) : r ? (
                              <span className={r.status === "problem" ? "text-destructive" : ""}>
                                {{ new: "Nouveau", exists: "Existe déjà", problem: "Problème" }[r.status]}{r.reason ? ` : ${r.reason}` : ""}
                              </span>
                            ) : "…"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={box}>
              <button type="button" disabled={running || selectedKeys.length === 0} onClick={() => void start(selectedKeys)} className="w-full rounded-full py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-brand)" }}>
                {running ? "Import en cours…" : `Importer ${selectedKeys.length} produits`}
              </button>
              {(running || resList.length > 0) && (
                <>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-brand-soft">
                    <div className="h-full bg-brand transition-all" style={{ width: `${(done / Math.max(1, running ? selectedKeys.length : done)) * 100}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
                    <Stat label="Créés" v={count("created")} /><Stat label="Mis à jour" v={count("updated")} />
                    <Stat label="Ignorés" v={count("skipped")} /><Stat label="Problèmes" v={count("problem")} />
                  </div>
                  {!running && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {problems.length > 0 && (
                        <button type="button" className={chip(false)} onClick={() => void start(problems.map((p) => p.key))}>Réessayer ces {problems.length}</button>
                      )}
                      <button type="button" className={chip(false)} onClick={downloadCsv}><Download className="me-1 inline h-4 w-4" />Télécharger le rapport (.csv)</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3">
      <p className="text-xl font-semibold">{v}</p>
      <p className="text-foreground/60">{label}</p>
    </div>
  );
}
