import { useMemo, useState } from "react";
import {
  Box,
  ChevronRight,
  Folder,
  FolderPlus,
  Home,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import {
  LEVEL_LABELS,
  canHoldProducts,
  childrenOf,
  pathOf,
  productsIn,
  type CatalogNode,
  type NodeLevel,
  type Product,
  type SiteData,
} from "@/lib/catalog-types";
import { ProductForm, type ProductDraft } from "@/components/admin/ProductForm";
import { cn } from "@/lib/utils";

const LEVEL_ICON: Record<NodeLevel, typeof Folder> = { 1: Folder, 2: Layers, 3: Tag, 4: Box };

export type CatalogActions = {
  createNode: (parentId: string | null, name: string) => Promise<void>;
  renameNode: (id: string, name: string) => Promise<void>;
  moveNode: (id: string, direction: "up" | "down") => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  nodeImpact: (id: string) => Promise<{ folders: number; products: number }>;
  saveProduct: (draft: ProductDraft & { node_id: string }) => Promise<void>;
  quickCreate: (
    fromId: string | null,
    folders: string[],
    draft: ProductDraft,
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
};

export function CatalogExplorer({
  data,
  busy,
  actions,
}: {
  data: SiteData;
  busy: boolean;
  actions: CatalogActions;
}) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ product?: Product } | null>(null);
  const [quick, setQuick] = useState(false);
  const [pending, setPending] = useState<{ node: CatalogNode; folders: number; products: number } | null>(
    null,
  );

  const current = useMemo(
    () => (currentId ? (data.nodes.find((n) => n.id === currentId) ?? null) : null),
    [data.nodes, currentId],
  );
  const trail = useMemo(() => pathOf(data.nodes, currentId), [data.nodes, currentId]);
  const folders = useMemo(() => childrenOf(data.nodes, currentId), [data.nodes, currentId]);
  const childLevel = ((current?.level ?? 0) + 1) as NodeLevel;
  const level = (current?.level ?? 0) as 0 | NodeLevel;
  const canCreateFolder = level < 4;
  const isLeaf = current ? canHoldProducts(current.level) : false;
  const missingLevels = useMemo(
    () =>
      Array.from({ length: Math.max(0, 3 - level) }, (_, i) => (level + i + 1) as NodeLevel),
    [level],
  );
  const products = useMemo(
    () => (isLeaf && current ? data.products.filter((p) => p.node_id === current.id) : []),
    [data.products, current, isLeaf],
  );

  const askDelete = async (node: CatalogNode) => {
    const impact = await actions.nodeImpact(node.id);
    setPending({ node, ...impact });
  };

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setCurrentId(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
            currentId === null ? "bg-brand-soft text-brand-deep" : "hover:text-brand",
          )}
        >
          <Home className="h-3.5 w-3.5" /> Catalogue
        </button>
        {trail.map((node) => (
          <span key={node.id} className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
            <button
              type="button"
              onClick={() => setCurrentId(node.id)}
              className={cn(
                "rounded-full px-3 py-1 font-semibold",
                currentId === node.id ? "bg-brand-soft text-brand-deep" : "hover:text-brand",
              )}
            >
              {node.name}
            </button>
          </span>
        ))}
        {busy && <Loader2 className="ms-auto h-4 w-4 animate-spin text-brand" />}
      </nav>

      {canCreateFolder && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            await actions.createNode(currentId, newName.trim());
            setNewName("");
          }}
          className="flex flex-wrap gap-3 rounded-3xl border border-border bg-card p-5"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Nouveau dossier · ${LEVEL_LABELS[childLevel]}`}
            className="min-w-[240px] flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            <FolderPlus className="h-4 w-4" /> Créer
          </button>
        </form>
      )}

      {folders.length === 0 && !isLeaf && (
        <p className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center text-sm text-foreground/60">
          Aucun dossier ici. Créez un {LEVEL_LABELS[childLevel].toLowerCase()} pour commencer.
        </p>
      )}

      <div className="space-y-3">
        {folders.map((node, index) => {
          const Icon = LEVEL_ICON[node.level];
          const count = productsIn(data.nodes, data.products, node.id).length;
          const subCount = childrenOf(data.nodes, node.id).length;
          return (
            <div
              key={node.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-deep">
                <Icon className="h-5 w-5" />
              </span>
              {renaming?.id === node.id ? (
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={(e) => setRenaming({ id: node.id, name: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && renaming.name.trim()) {
                      await actions.renameNode(node.id, renaming.name.trim());
                      setRenaming(null);
                    }
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentId(node.id)}
                  className="min-w-0 flex-1 text-start"
                >
                  <p className="truncate font-semibold">{node.name}</p>
                  <p className="text-xs text-foreground/55">
                    {LEVEL_LABELS[node.level]} · {subCount} sous-dossier(s) · {count} produit(s)
                  </p>
                </button>
              )}

              {renaming?.id === node.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (renaming.name.trim()) await actions.renameNode(node.id, renaming.name.trim());
                    setRenaming(null);
                  }}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  OK
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => actions.moveNode(node.id, "up")}
                    aria-label="Monter"
                    className="rounded-full px-2 py-1 text-xs font-semibold text-foreground/50 hover:text-brand disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === folders.length - 1}
                    onClick={() => actions.moveNode(node.id, "down")}
                    aria-label="Descendre"
                    className="rounded-full px-2 py-1 text-xs font-semibold text-foreground/50 hover:text-brand disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenaming({ id: node.id, name: node.name })}
                    aria-label="Renommer le dossier"
                    className="rounded-full p-2 text-foreground/50 hover:bg-brand-soft hover:text-brand"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(node)}
                    aria-label="Supprimer le dossier"
                    className="rounded-full p-2 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isLeaf && current && (
        <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Produits</h3>
          {products.length === 0 && !editing && (
            <p className="text-sm text-foreground/60">Aucun produit dans ce modèle.</p>
          )}
          {products.map((product) =>
            editing?.product?.id === product.id ? (
              <ProductForm
                key={product.id}
                product={product}
                nodeId={current.id}
                onCancel={() => setEditing(null)}
                onSave={async (draft) => {
                  await actions.saveProduct(draft);
                  setEditing(null);
                }}
              />
            ) : (
              <div
                key={product.id}
                className="flex items-center gap-4 rounded-2xl border border-border p-4"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-soft/60">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-brand/40">
                      <Package className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground/55">
                    {[product.brand, product.serial_number].filter(Boolean).join(" · ") || "—"} ·{" "}
                    <span className={product.stock > 0 ? "text-brand" : "text-destructive"}>
                      {product.stock > 0 ? `${product.stock} en stock` : "Rupture de stock"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ product })}
                  aria-label="Modifier l'article"
                  className="rounded-full p-2 text-foreground/50 hover:bg-brand-soft hover:text-brand"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Supprimer « ${product.name} » ?`)) {
                      await actions.deleteProduct(product.id);
                    }
                  }}
                  aria-label="Supprimer l'article"
                  className="rounded-full p-2 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          )}

          {editing && !editing.product ? (
            <ProductForm
              nodeId={current.id}
              onCancel={() => setEditing(null)}
              onSave={async (draft) => {
                await actions.saveProduct(draft);
                setEditing(null);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing({})}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand/40 px-5 py-2.5 text-sm font-semibold text-brand hover:bg-brand-soft"
            >
              <Plus className="h-4 w-4" /> Ajouter un article
            </button>
          )}
        </section>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">Supprimer « {pending.node.name} » ?</h3>
            <p className="mt-3 text-sm text-foreground/70">
              {pending.folders === 0 && pending.products === 0
                ? "Ce dossier est vide."
                : `Ce dossier contient ${pending.products} produit(s) et ${pending.folders} sous-dossier(s). Les supprimer est irréversible.`}{" "}
              Continuer ?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  const id = pending.node.id;
                  setPending(null);
                  if (currentId && pathOf(data.nodes, currentId).some((n) => n.id === id)) {
                    setCurrentId(pending.node.parent_id);
                  }
                  await actions.deleteNode(id);
                }}
                className="rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
