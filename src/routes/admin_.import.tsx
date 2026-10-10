import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Download, FileUp, Loader2, Plus, Upload, X } from "lucide-react";
import { adminCreateNode, adminGetData, adminStatus } from "@/lib/admin.functions";
import { adminBulkImport, adminBulkPreview } from "@/lib/bulk-import.functions";
import {
  foldText,
  readBulkText,
  type BulkItem,
  type BulkOptions,
  type BulkRowResult,
  type PreviewRow,
} from "@/lib/bulk-import-types";
import { pathOf, productsIn, type CatalogNode, type Product } from "@/lib/catalog-types";
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
/** loose key: accents/case ignored, plural "s" ignored ("Réfrigérateur combiné" = "Réfrigérateurs combinés") */
const loose = (v: string) => foldText(v).split(/[\s\-/]+/).map((w) => w.replace(/(s|x)$/, "")).join(" ");

type Folder = { id: string; label: string; name: string; count: number; slugPath: string };

function useFolders(nodes: CatalogNode[], products: Product[]) {
  return useMemo<Folder[]>(
    () =>
      nodes
        .map((n) => {
          const path = pathOf(nodes, n.id);
          return {
            id: n.id,
            name: n.name,
            label: path.map((p) => p.name).join(" › "),
            slugPath: path.map((p) => p.slug).join("/"),
            count: productsIn(nodes, products, n.id).length,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, products],
  );
}

/** Search box over every section (full path searched). */
function SectionSearch({
  folders,
  onPick,
  onCreate,
  placeholder = "Mettre ces produits dans…",
  compact,
}: {
  folders: Folder[];
  onPick: (id: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!compact);
  const shown = q ? folders.filter((f) => foldText(f.label).includes(foldText(q))) : folders;
  return (
    <div className="relative">
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={cn("w-full rounded-lg border border-border px-3", compact ? "py-1 text-xs" : "py-2.5 text-sm")}
      />
      {open && (
        <div className={cn("mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card", compact && "absolute inset-x-0 z-30 min-w-64 shadow-[var(--shadow-card)]")}>
          {shown.map((f) => (
            <button key={f.id} type="button"
              onClick={() => {
                onPick(f.id);
                setQ("");
                if (compact) setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm hover:bg-brand-soft">
              <span className="truncate">{f.label}</span>
              <span className="shrink-0 text-xs text-foreground/45">{f.count}</span>
            </button>
          ))}
          {q && shown.length === 0 && onCreate && (
            <button type="button" onClick={() => onCreate(q.trim())} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
              <Plus className="h-4 w-4" /> Créer la section « {q.trim()} »
            </button>
          )}
          {q && shown.length === 0 && !onCreate && <p className="px-3 py-2 text-xs text-foreground/50">Aucune section</p>}
          {compact && (
            <button type="button" onClick={() => setOpen(false)} className="w-full border-t border-border px-3 py-1 text-xs text-foreground/50">Fermer</button>
          )}
        </div>
      )}
    </div>
  );
}

function ImportPage() {
  const status = useServerFn(adminStatus);
  const getData = useServerFn(adminGetData);
  const preview = useServerFn(adminBulkPreview);
  const runBatch = useServerFn(adminBulkImport);
  const createNode = useServerFn(adminCreateNode);

  const [auth, setAuth] = useState<boolean | null>(null);
  const [nodes, setNodes] = useState<CatalogNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [failed, setFailed] = useState<{ sourceUrl: string; error: string }[]>([]);
  const [readError, setReadError] = useState("");
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<"one" | "file">("one");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, PreviewRow>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "exists" | "look">("all");
  const [detail, setDetail] = useState<BulkItem | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<Record<string, BulkRowResult>>({});
  const [opts, setOpts] = useState<Pick<BulkOptions, "mode" | "copyImages" | "dropForeignPrice">>({
    mode: "skip",
    copyImages: true,
    dropForeignPrice: false,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const loadData = () => getData().then((d) => {
    setNodes(d.nodes);
    setProducts(d.products);
  });
  useEffect(() => {
    void status().then((s) => {
      setAuth(s.authenticated);
      if (s.authenticated) void loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const folders = useFolders(nodes, products);
  const byLoose = useMemo(() => {
    const m = new Map<string, Folder>();
    for (const f of folders) if (!m.has(loose(f.name))) m.set(loose(f.name), f);
    return m;
  }, [folders]);

  /** Section of each product before saving. */
  const sectionOf = (item: BulkItem): string | null => {
    if (overrides[item.key]) return overrides[item.key]!;
    if (mode === "one") return targetId;
    if (!item.category) return null;
    return nameMap[item.category] ?? byLoose.get(loose(item.category))?.id ?? null;
  };
  const unmatchedNames = useMemo(() => {
    if (mode !== "file") return [];
    const names = new Set(items.map((i) => i.category).filter((c) => c && !byLoose.get(loose(c))));
    return [...names];
  }, [items, mode, byLoose]);

  const addTexts = async (texts: string[]) => {
    setReading(true);
    setReadError("");
    await new Promise((r) => setTimeout(r, 20));
    const merged = new Map(items.map((i) => [i.sourceUrl || i.key, i]));
    const fails = [...failed];
    let count = merged.size;
    for (const text of texts) {
      const res = readBulkText(text);
      if (!res.ok) {
        setReadError(res.error);
        continue;
      }
      for (const it of res.items) {
        const key = it.sourceUrl || `${it.brand}-${it.model}-${count++}`;
        if (!merged.has(key)) merged.set(key, { ...it, key });
      }
      fails.push(...res.failed);
    }
    const list = [...merged.values()];
    setItems(list);
    setFailed(fails);
    setSelected(new Set(list.map((i) => i.key)));
    setResults({});
    setReading(false);
  };
  const readFiles = async (files: FileList | File[]) => {
    const arr = [...files];
    if (!arr.length) return;
    setReading(true);
    const texts = await Promise.all(arr.map((f) => f.text()));
    await addTexts(texts);
  };

  // existing-product check
  useEffect(() => {
    if (!items.length) return;
    const t = window.setTimeout(() => {
      const chunk = items.map((i) => ({ ...i, specs: [], specGroups: [], images: [] }));
      void preview({ data: { items: chunk, options: { ...opts, folderId: null, fallbackId: null, createMissing: false } } })
        .then((out) => setRows(Object.fromEntries(out.map((r) => [r.key, r]))))
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const lookReason = (i: BulkItem) => {
    const r: string[] = [];
    if (i.needsReview) r.push("à vérifier (extension)");
    if (i.images.length === 0) r.push("pas de photo");
    if (!sectionOf(i)) r.push("pas de section");
    if (!i.name) r.push("pas de nom");
    return r;
  };
  const statusOf = (i: BulkItem): "new" | "exists" | "look" => {
    if (lookReason(i).length) return "look";
    return rows[i.key]?.status === "exists" ? "exists" : "new";
  };

  const brandsSummary = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.brand || "?", (m.get(i.brand || "?") ?? 0) + 1);
    return [...m.entries()].map(([b, c]) => `${b} ${c}`).join(", ");
  }, [items]);

  const visible = items.filter((i) => {
    if (filter !== "all" && statusOf(i) !== filter) return false;
    return foldText(`${i.name} ${i.brand} ${i.model} ${i.category}`).includes(foldText(search));
  });
  const toImport = items.filter((i) => selected.has(i.key) && sectionOf(i) && i.name);
  const targetLabel = mode === "one" ? folders.find((f) => f.id === targetId)?.label : "les sections choisies";

  const createSection = async (name: string, parentId: string | null) => {
    const res = (await createNode({ data: { parentId, name } as never })) as { id?: string } | undefined;
    await loadData();
    setCreating(null);
    return res?.id ?? null;
  };

  const start = async (list: BulkItem[]) => {
    setRunning(true);
    setDone(0);
    setTotal(list.length);
    for (let k = 0; k < list.length; k += BATCH) {
      const chunk = list.slice(k, k + BATCH).map((i) => ({ ...i, nodeId: sectionOf(i) }));
      try {
        const out = await runBatch({
          data: { items: chunk, options: { ...opts, folderId: null, fallbackId: null, createMissing: false } },
        });
        setResults((prev) => ({ ...prev, ...Object.fromEntries(out.map((r) => [r.key, r])) }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur";
        setResults((prev) => ({ ...prev, ...Object.fromEntries(chunk.map((c) => [c.key, { key: c.key, outcome: "problem" as const, error: msg }])) }));
      }
      setDone((d) => d + chunk.length);
    }
    setRunning(false);
    void loadData();
  };

  const resList = Object.values(results);
  const count = (o: BulkRowResult["outcome"]) => resList.filter((r) => r.outcome === o).length;
  const problems = resList.filter((r) => r.outcome === "problem");

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      "nom,marque,modele,lien,resultat,erreur,avertissements",
      ...items.filter((i) => results[i.key]).map((i) => {
        const r = results[i.key]!;
        return [i.name, i.brand, i.model, i.sourceUrl, r.outcome, r.error ?? "", (r.warnings ?? []).join(" | ")].map(esc).join(",");
      }),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    a.download = "rapport-import.csv";
    a.click();
  };

  if (auth === null) return <Loader2 className="mx-auto mt-24 h-6 w-6 animate-spin text-brand" />;
  if (!auth)
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <p>Connectez-vous d'abord à l'administration.</p>
        <Link to="/admin" className="mt-4 inline-block font-semibold text-brand">Aller à l'admin</Link>
      </div>
    );

  const box = "rounded-2xl border border-border bg-card p-5 sm:p-6";
  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-semibold", on ? "border-brand bg-brand text-primary-foreground" : "border-border");
  const targetFolder = folders.find((f) => f.id === targetId);

  return (
    <div className="min-h-screen bg-brand-soft/30">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" /> Retour à l'admin</Link>
        <h1 className="text-2xl font-semibold">Importer des produits</h1>

        {/* STEP 1 */}
        <div className={box}>
          <h2 className="font-semibold">1. Le fichier</h2>
          {!pasteMode ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void readFiles(e.dataTransfer.files); }}
              className={cn("mt-3 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors", dragging ? "border-brand bg-brand-soft" : "border-brand/40")}
            >
              <Upload className="h-8 w-8 text-brand" />
              <p className="font-semibold">Déposez votre fichier .json ici (un ou plusieurs)</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} className={chip(true)}><FileUp className="me-1 inline h-4 w-4" />Choisir un fichier</button>
                <button type="button" onClick={() => setPasteMode(true)} className={chip(false)}>Coller le texte à la place</button>
              </div>
              <input ref={fileInput} type="file" multiple accept=".json,application/json" className="hidden"
                onChange={(e) => { if (e.target.files) void readFiles(e.target.files); e.target.value = ""; }} />
            </div>
          ) : (
            <div className="mt-3">
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Collez ici le texte JSON de l'extension" className="h-48 w-full rounded-xl border border-border p-3 font-mono text-xs" />
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={!paste.trim()} onClick={() => void addTexts([paste])} className={chip(true)}>Lire</button>
                <button type="button" onClick={() => setPasteMode(false)} className={chip(false)}>Revenir au fichier</button>
              </div>
            </div>
          )}
          {reading && <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin text-brand" /> Lecture du fichier…</p>}
          {readError && <p className="mt-3 text-sm font-semibold text-destructive">{readError}</p>}
          {items.length > 0 && !reading && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <p className="font-semibold text-brand"><Check className="me-1 inline h-4 w-4" />Fichier lu : {items.length} produits ({brandsSummary})</p>
              <button type="button" onClick={() => { setItems([]); setFailed([]); setResults({}); }} className="text-xs text-destructive">Tout effacer</button>
            </div>
          )}
          {failed.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">{failed.length} liens que l'extension n'a pas pu lire</summary>
              <ul className="mt-2 space-y-1">{failed.map((f, i) => <li key={i} className="break-all text-foreground/70">{f.sourceUrl} — {f.error}</li>)}</ul>
            </details>
          )}
        </div>

        {items.length > 0 && (
          <>
            {/* STEP 2 */}
            <div className={box}>
              <h2 className="font-semibold">2. Où mettre les produits ?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={chip(mode === "one")} onClick={() => setMode("one")}>Tout dans une seule section</button>
                <button type="button" className={chip(mode === "file")} onClick={() => setMode("file")}>Utiliser la catégorie écrite dans le fichier</button>
              </div>
              {mode === "one" ? (
                <div className="mt-4">
                  {targetFolder && (
                    <p className="mb-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-deep">
                      ✓ {targetFolder.label} <button type="button" onClick={() => setTargetId(null)} className="ms-2 text-xs text-destructive">changer</button>
                    </p>
                  )}
                  {!targetFolder && <SectionSearch folders={folders} onPick={setTargetId} onCreate={(n) => setCreating(n)} />}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {unmatchedNames.length === 0 ? (
                    <p className="text-sm text-brand">✓ Toutes les catégories du fichier correspondent à une section.</p>
                  ) : (
                    unmatchedNames.map((name) => (
                      <div key={name} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[200px_minmax(0,1fr)]">
                        <p className="text-sm font-semibold">« {name} »</p>
                        {nameMap[name] ? (
                          <p className="text-sm">→ {folders.find((f) => f.id === nameMap[name])?.label} <button type="button" onClick={() => setNameMap((m) => { const n = { ...m }; delete n[name]; return n; })} className="ms-2 text-xs text-destructive">changer</button></p>
                        ) : (
                          <SectionSearch compact folders={folders} placeholder="Choisir une section…" onPick={(id) => setNameMap((m) => ({ ...m, [name]: id }))} onCreate={(n) => setCreating(n)} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
              {creating !== null && (
                <div className="mt-4 rounded-lg border border-brand/40 bg-brand-soft/40 p-4">
                  <p className="text-sm font-semibold">Créer « {creating} » — dans quelle section parente ?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={chip(false)} onClick={async () => { const id = await createSection(creating, null); if (id && mode === "one") setTargetId(id); }}>Au premier niveau</button>
                    <button type="button" className={chip(false)} onClick={() => setCreating(null)}>Annuler</button>
                  </div>
                  <div className="mt-2">
                    <SectionSearch folders={folders} placeholder="…ou choisir le parent" onPick={async (pid) => { const id = await createSection(creating, pid); if (id && mode === "one") setTargetId(id); }} />
                  </div>
                </div>
              )}
            </div>

            {/* STEP 3 */}
            <div className={box}>
              <h2 className="font-semibold">3. Vérifier avant d'enregistrer</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-sm font-medium">Si le produit est déjà sur mon site</p>
                  <select value={opts.mode} onChange={(e) => setOpts({ ...opts, mode: e.target.value as BulkOptions["mode"] })} className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                    <option value="skip">Le passer (ne rien changer)</option>
                    <option value="empty">Remplir seulement les champs vides</option>
                    <option value="all">Tout remplacer</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opts.copyImages} onChange={(e) => setOpts({ ...opts, copyImages: e.target.checked })} /> Copier les photos dans mon stockage</label>
                {items.some((i) => i.currency && i.currency !== "MAD") && (
                  <label className="flex items-center gap-2 rounded-lg bg-yellow-50 p-2 text-sm"><input type="checkbox" checked={opts.dropForeignPrice} onChange={(e) => setOpts({ ...opts, dropForeignPrice: e.target.checked })} /> Prix dans une autre devise : laisser vide</label>
                )}
              </div>
              <p className="mt-2 text-xs text-foreground/55">Produits sans prix : le prix reste vide (« Prix sur demande »). Vous pourrez taper les prix ensuite dans l'onglet « Prix » de l'admin.</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="min-w-40 flex-1 rounded-full border border-border px-4 py-2 text-sm" />
                {([["all", "Tous"], ["new", "Nouveaux"], ["exists", "Déjà là"], ["look", "À regarder"]] as const).map(([f, l]) => (
                  <button key={f} type="button" className={chip(filter === f)} onClick={() => setFilter(f)}>{l} ({f === "all" ? items.length : items.filter((i) => statusOf(i) === f).length})</button>
                ))}
              </div>
              {selected.size > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
                  <span className="font-semibold">{selected.size} cochés — déplacer vers :</span>
                  <div className="min-w-64 flex-1"><SectionSearch compact folders={folders} placeholder="Choisir une section…" onPick={(id) => setOverrides((o) => ({ ...o, ...Object.fromEntries([...selected].map((k) => [k, id])) }))} /></div>
                </div>
              )}

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-foreground/60">
                    <tr>
                      <th className="p-2"><input type="checkbox" checked={visible.length > 0 && visible.every((v) => selected.has(v.key))} onChange={(e) => { const n = new Set(selected); visible.forEach((v) => (e.target.checked ? n.add(v.key) : n.delete(v.key))); setSelected(n); }} /></th>
                      <th className="p-2" /><th className="p-2 text-start">Nom</th><th className="p-2 text-start">Marque / modèle</th><th className="p-2 text-start">Section</th>
                      <th className="p-2 text-start">Prix</th><th className="p-2">Photos</th><th className="p-2">Specs</th><th className="p-2 text-start">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((i) => {
                      const st = statusOf(i);
                      const res = results[i.key];
                      const sec = sectionOf(i);
                      const foreign = i.currency && i.currency !== "MAD";
                      return (
                        <tr key={i.key} className={cn("border-t border-border", st === "look" && "bg-yellow-50/70")}>
                          <td className="p-2"><input type="checkbox" checked={selected.has(i.key)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(i.key); else n.delete(i.key); setSelected(n); }} /></td>
                          <td className="p-2">{i.images[0] ? <img src={i.images[0]} alt="" className="h-10 w-10 rounded object-contain" /> : "—"}</td>
                          <td className="p-2"><button type="button" onClick={() => setDetail(i)} className="text-start font-medium hover:text-brand hover:underline">{i.name || "(sans nom)"}</button></td>
                          <td className="p-2">{i.brand}<br /><span className="text-xs text-foreground/50">{i.model}</span></td>
                          <td className="w-56 p-2">
                            <p className="mb-1 truncate text-xs">{sec ? folders.find((f) => f.id === sec)?.label : <span className="text-destructive">aucune</span>}</p>
                            <SectionSearch compact folders={folders} placeholder="Changer…" onPick={(id) => setOverrides((o) => ({ ...o, [i.key]: id }))} />
                          </td>
                          <td className={cn("p-2", foreign && "bg-yellow-100")}>{i.priceValue === null ? <span className="text-foreground/45">—</span> : `${i.priceValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${i.currency}`}</td>
                          <td className="p-2 text-center">{i.images.length}</td>
                          <td className="p-2 text-center">{i.specGroups.reduce((a, g) => a + g.rows.length, 0) || i.specs.length}</td>
                          <td className="p-2 text-xs">
                            {res ? (
                              <span className={res.outcome === "problem" ? "text-destructive" : "text-brand"}>
                                {{ created: "Ajouté", updated: "Mis à jour", skipped: "Passé", problem: "Problème" }[res.outcome]}{res.error ? ` : ${res.error}` : ""}{res.warnings?.length ? ` ⚠ ${res.warnings.length} photo(s) non copiée(s)` : ""}
                              </span>
                            ) : st === "look" ? (
                              <span className="text-yellow-800">À regarder : {lookReason(i).join(", ")}</span>
                            ) : st === "exists" ? (
                              <span>Déjà sur le site → {{ skip: "passé", empty: "champs vides remplis", all: "tout remplacé" }[opts.mode]}</span>
                            ) : (
                              <span className="text-brand">Nouveau</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* STEP 4 */}
            <div className={box}>
              <button type="button" disabled={running || toImport.length === 0} onClick={() => void start(toImport)}
                className="w-full rounded-full bg-brand py-4 text-lg font-semibold text-primary-foreground disabled:opacity-50">
                {running ? "Import en cours…" : `Ajouter ${toImport.length} produits dans ${targetLabel ?? "…"}`}
              </button>
              {toImport.length === 0 && !running && <p className="mt-2 text-center text-sm text-foreground/60">Choisissez d'abord une section (étape 2).</p>}
              {(running || resList.length > 0) && (
                <>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-brand-soft">
                    <div className="h-full bg-brand transition-all" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-3 text-center text-sm">
                    {([["created", "Ajoutés"], ["updated", "Mis à jour"], ["skipped", "Passés"], ["problem", "Problèmes"]] as const).map(([k, l]) => (
                      <div key={k} className="rounded-xl border border-border p-2"><p className="text-xl font-semibold">{count(k)}</p><p className="text-foreground/60">{l}</p></div>
                    ))}
                  </div>
                  {!running && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {problems.length > 0 && <button type="button" className={chip(false)} onClick={() => void start(items.filter((i) => problems.some((p) => p.key === i.key)))}>Réessayer ces {problems.length}</button>}
                      {mode === "one" && targetFolder && <a href={`/produits/${targetFolder.slugPath}`} target="_blank" rel="noreferrer" className={chip(false)}>Voir la section sur le site</a>}
                      <button type="button" className={chip(false)} onClick={downloadCsv}><Download className="me-1 inline h-4 w-4" />Télécharger le rapport (.csv)</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-4" onClick={() => setDetail(null)}>
          <div className="mx-auto max-w-4xl rounded-2xl bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-brand uppercase">{detail.brand}</p>
                <h3 className="text-lg font-semibold">{detail.name}</h3>
                <p className="text-sm text-foreground/55">Réf. {detail.model}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {detail.images.map((src, k) => <img key={k} src={src} alt="" className="aspect-square w-full rounded-lg border border-border object-contain" />)}
            </div>
            <p className="mt-2 text-xs text-foreground/55">{detail.images.length} photos</p>
            <div className="mt-4 space-y-3">
              {(detail.specGroups.length ? detail.specGroups : [{ title: "Caractéristiques", rows: detail.specs }]).map((g, k) => (
                <div key={k} className="rounded-lg border border-border">
                  <p className="bg-brand-soft/40 px-4 py-2 text-sm font-bold">{g.title || "Caractéristiques"}</p>
                  <table className="w-full text-sm"><tbody>
                    {g.rows.map((r, j) => <tr key={j} className="border-t border-border/60"><th className="w-1/2 px-4 py-1.5 text-start font-normal text-foreground/60">{r.label}</th><td className="px-4 py-1.5">{r.value}</td></tr>)}
                  </tbody></table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
