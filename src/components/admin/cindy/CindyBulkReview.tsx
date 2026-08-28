import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronDown,
  Circle,
  Copy,
  Globe,
  ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type { CindyBulkItem } from "@/lib/cindy-types";
import type { CatalogNode, Product, SiteData } from "@/lib/catalog-types";
import { canHoldProducts, pathOf } from "@/lib/catalog-types";
import type { CindyImportPayload } from "./CindyReview";
import { cn } from "@/lib/utils";

type Row = {
  key: string;
  ref: string;
  name: string;
  brand: string;
  reference: string;
  characteristics: string;
  specs: { label: string; value: string }[];
  images: string[];
  cover: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  official: boolean;
  price: string;
  stock: string;
  nodeId: string;
  duplicate: Product | null;
  skip: boolean;
  status: "pending" | "creating" | "done" | "error";
  error?: string;
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function buildRows(items: CindyBulkItem[], products: Product[], defaultNodeId: string): Row[] {
  return items
    .filter((item) => item.status === "done" && item.product)
    .map((item) => {
      const product = item.product!;
      const reference = product.model || item.ref;
      const duplicate =
        products.find(
          (p) =>
            (norm(p.serial_number) && norm(p.serial_number) === norm(reference)) ||
            norm(p.name) === norm(product.name),
        ) ?? null;
      return {
        key: `${item.index}-${item.ref}`,
        ref: item.ref,
        name: product.name,
        brand: product.brand,
        reference,
        characteristics: product.characteristics,
        specs: product.specifications,
        images: product.images,
        cover: product.images[0] ?? null,
        sourceUrl: (product.sources.find((s) => s.official) ?? product.sources[0])?.url ?? null,
        sourceName: (product.sources.find((s) => s.official) ?? product.sources[0])?.name ?? null,
        official: product.sources.some((s) => s.official),
        price: product.price === null ? "" : String(product.price),
        stock: "0",
        nodeId: defaultNodeId,
        duplicate,
        skip: Boolean(duplicate),
        status: "pending" as const,
      };
    });
}

export function CindyBulkReview({
  items,
  data,
  defaultNodeId,
  onCancel,
  onImport,
  onRetry,
}: {
  items: CindyBulkItem[];
  data: SiteData;
  defaultNodeId?: string | null;
  onCancel: () => void;
  onImport: (payload: CindyImportPayload) => Promise<void>;
  onRetry?: (refs: string[]) => void;
}) {
  const leaves = useMemo(
    () => data.nodes.filter((n: CatalogNode) => canHoldProducts(n.level)),
    [data.nodes],
  );
  const nodeLabel = (id: string) =>
    pathOf(data.nodes, id)
      .map((n) => n.name)
      .join(" › ");

  const [rows, setRows] = useState<Row[]>(() =>
    buildRows(items, data.products, defaultNodeId ?? leaves[0]?.id ?? ""),
  );
  const failures = items.filter((item) => item.status === "error");

  const [mode, setMode] = useState<"common" | "individual">("common");
  const [commonPrice, setCommonPrice] = useState("");
  const [commonStock, setCommonStock] = useState("0");
  const [commonNode, setCommonNode] = useState(defaultNodeId ?? leaves[0]?.id ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [phase, setPhase] = useState<"review" | "confirm" | "creating" | "summary">("review");
  const [error, setError] = useState<string | null>(null);

  const patch = (key: string, next: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const selected = rows.filter((r) => !r.skip);
  const created = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "error");

  const valuesFor = (row: Row) =>
    mode === "common"
      ? { price: commonPrice, stock: commonStock, nodeId: commonNode }
      : { price: row.price, stock: row.stock, nodeId: row.nodeId };

  const startConfirm = () => {
    setError(null);
    if (selected.length === 0) {
      setError("Aucun produit sélectionné.");
      return;
    }
    const missing = selected.find((row) => !valuesFor(row).nodeId);
    if (missing) {
      setError("Choisissez une catégorie de destination pour chaque produit.");
      return;
    }
    setPhase("confirm");
  };

  const createAll = async (only?: string[]) => {
    setPhase("creating");
    setError(null);
    const targets = rows.filter(
      (row) => !row.skip && (only ? only.includes(row.key) : row.status !== "done"),
    );
    for (const row of targets) {
      patch(row.key, { status: "creating", error: "" });
      const { price, stock, nodeId } = valuesFor(row);
      try {
        await onImport({
          node_id: nodeId,
          name: row.name.trim(),
          brand: row.brand.trim(),
          serial_number: row.reference.trim(),
          stock: Number(stock) || 0,
          price: price.trim() === "" ? null : Number(price),
          characteristics: row.characteristics,
          specifications: row.specs,
          gallery: row.images.filter((img) => img !== row.cover),
          marketing_sections: [],
          imageUrl: row.cover,
          source_url: row.sourceUrl,
          source_name: row.sourceName,
        });
        patch(row.key, { status: "done" });
      } catch (err) {
        patch(row.key, {
          status: "error",
          error: err instanceof Error ? err.message : "Création impossible",
        });
      }
    }
    setPhase("summary");
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Création groupée
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold">
            {rows.length} produit{rows.length > 1 ? "s" : ""} prêt
            {rows.length > 1 ? "s" : ""} à créer
          </h3>
        </div>
        {phase === "review" && (
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1 text-xs font-semibold">
            {(
              [
                ["common", "Mêmes valeurs pour tous"],
                ["individual", "Définir individuellement"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition",
                  mode === id ? "bg-brand text-primary-foreground" : "text-foreground/60",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {phase === "review" && mode === "common" && (
        <div className="grid gap-4 border-b border-border bg-brand-soft/25 px-6 py-5 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
              Prix (MAD)
            </span>
            <input
              value={commonPrice}
              onChange={(e) => setCommonPrice(e.target.value)}
              type="number"
              placeholder="Ex. 6499"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
              Stock
            </span>
            <input
              value={commonStock}
              onChange={(e) => setCommonStock(e.target.value)}
              type="number"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
              Catégorie
            </span>
            <select
              value={commonNode}
              onChange={(e) => setCommonNode(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
            >
              <option value="">— Choisir —</option>
              {leaves.map((node) => (
                <option key={node.id} value={node.id}>
                  {nodeLabel(node.id)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="divide-y divide-border">
        {rows.map((row) => {
          const values = valuesFor(row);
          return (
            <div key={row.key} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
                  {row.cover ? (
                    <img src={row.cover} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-foreground/30">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    {row.official ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                        <BadgeCheck className="h-3 w-3" /> Source officielle
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/55 uppercase">
                        <Globe className="h-3 w-3" /> Source secondaire
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-brand" /> {row.brand || "Marque inconnue"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3 text-brand" /> {row.reference}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {row.characteristics ? (
                        <Check className="h-3 w-3 text-brand" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-foreground/35" />
                      )}
                      Caractéristiques
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {row.images.length > 0 ? (
                        <Check className="h-3 w-3 text-brand" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-foreground/35" />
                      )}
                      {row.images.length} image(s)
                    </span>
                  </p>

                  {row.duplicate && (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[oklch(0.95_0.06_85)] px-3 py-1.5 text-xs font-semibold text-[oklch(0.45_0.12_75)]">
                      <Copy className="h-3.5 w-3.5" />
                      Référence déjà présente dans le catalogue ({row.duplicate.name}) —
                      {row.skip ? " ignorée" : " sera dupliquée"}
                      <button
                        type="button"
                        onClick={() => patch(row.key, { skip: !row.skip })}
                        className="underline"
                      >
                        {row.skip ? "Créer quand même" : "Ignorer"}
                      </button>
                    </p>
                  )}

                  {mode === "individual" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <input
                        value={row.price}
                        onChange={(e) => patch(row.key, { price: e.target.value })}
                        type="number"
                        placeholder="Prix (MAD)"
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                      <input
                        value={row.stock}
                        onChange={(e) => patch(row.key, { stock: e.target.value })}
                        type="number"
                        placeholder="Stock"
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                      <select
                        value={row.nodeId}
                        onChange={(e) => patch(row.key, { nodeId: e.target.value })}
                        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
                      >
                        <option value="">— Catégorie —</option>
                        {leaves.map((node) => (
                          <option key={node.id} value={node.id}>
                            {nodeLabel(node.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {mode === "common" && values.nodeId && (
                    <p className="mt-2 text-[11px] text-foreground/45">
                      {nodeLabel(values.nodeId)} · {values.price || "prix non défini"} ·{" "}
                      {values.stock} en stock
                    </p>
                  )}

                  {expanded === row.key && (
                    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-4">
                      <input
                        value={row.name}
                        onChange={(e) => patch(row.key, { name: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={row.brand}
                          onChange={(e) => patch(row.key, { brand: e.target.value })}
                          placeholder="Marque"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                        <input
                          value={row.reference}
                          onChange={(e) => patch(row.key, { reference: e.target.value })}
                          placeholder="Référence"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                      </div>
                      <textarea
                        value={row.characteristics}
                        onChange={(e) => patch(row.key, { characteristics: e.target.value })}
                        rows={5}
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                      {row.images.length > 0 && (
                        <div className="grid grid-cols-6 gap-2">
                          {row.images.map((img) => (
                            <button
                              key={img}
                              type="button"
                              onClick={() => patch(row.key, { cover: img })}
                              className={cn(
                                "aspect-square overflow-hidden rounded-xl border bg-background",
                                row.cover === img
                                  ? "border-brand ring-2 ring-brand/30"
                                  : "border-border",
                              )}
                            >
                              <img src={img} alt="" className="h-full w-full object-contain" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.status === "creating" && (
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  )}
                  {row.status === "done" && <Check className="h-4 w-4 text-brand" />}
                  {row.status === "error" && (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  {row.status === "pending" && phase === "creating" && (
                    <Circle className="h-3.5 w-3.5 text-foreground/30" />
                  )}
                  {phase === "review" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === row.key ? null : row.key)}
                        className="rounded-full border border-border p-2 text-foreground/60 hover:border-brand hover:text-brand"
                        aria-label="Modifier"
                      >
                        {expanded === row.key ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                        className="rounded-full border border-border p-2 text-foreground/50 hover:border-destructive hover:text-destructive"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {row.error && (
                <p className="mt-2 text-xs font-semibold text-destructive">{row.error}</p>
              )}
            </div>
          );
        })}
      </div>

      {failures.length > 0 && (
        <div className="border-t border-border bg-destructive/5 px-6 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> {failures.length} référence(s) à revoir
          </p>
          <ul className="mt-2 space-y-1.5">
            {failures.map((item) => (
              <li
                key={item.index}
                className="flex flex-wrap items-center gap-2 text-xs text-foreground/70"
              >
                <span className="font-semibold">{item.ref}</span>
                <span>— {item.message}</span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry([item.ref])}
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Réessayer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="px-6 pt-4 text-sm font-semibold text-destructive">{error}</p>}

      <footer className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-5">
        {phase === "review" && (
          <>
            <button
              type="button"
              onClick={startConfirm}
              className="rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-brand)" }}
            >
              Créer tout ({selected.length})
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:border-brand"
            >
              Annuler
            </button>
          </>
        )}

        {phase === "confirm" && (
          <div className="w-full rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
            <p className="text-sm font-semibold">
              Vous allez créer {selected.length} produit{selected.length > 1 ? "s" : ""}.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPhase("review")}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-brand"
              >
                Revoir
              </button>
              <button
                type="button"
                onClick={() => void createAll()}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                Créer tout
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-destructive hover:text-destructive"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {phase === "creating" && (
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin text-brand" /> Création des produits…
          </p>
        )}

        {phase === "summary" && (
          <div className="w-full">
            <p className="text-sm font-semibold">
              {created} produit{created > 1 ? "s" : ""} créé{created > 1 ? "s" : ""} avec succès.
              {failed.length > 0 && ` ⚠ ${failed.length} nécessite(nt) votre attention.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {failed.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => void createAll(failed.map((r) => r.key))}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Réessayer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("review")}
                    className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-brand"
                  >
                    Modifier
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-brand"
              >
                <X className="h-3.5 w-3.5" /> Fermer
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
