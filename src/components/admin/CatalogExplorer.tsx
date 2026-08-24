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
import { ProductForm, type FolderDraft, type ProductDraft } from "@/components/admin/ProductForm";
import { NodeForm } from "@/components/admin/NodeForm";
import type { ImageDraft } from "@/components/admin/ImagePicker";
import { cn } from "@/lib/utils";

const LEVEL_ICON: Record<NodeLevel, typeof Folder> = { 1: Folder, 2: Layers, 3: Tag, 4: Box };

export type CatalogActions = {
  createNode: (parentId: string | null, name: string, image: ImageDraft) => Promise<void>;
  renameNode: (id: string, name: string, image: ImageDraft) => Promise<void>;
  moveNode: (id: string, direction: "up" | "down") => Promise<void>;
  reparentNode: (id: string, parentId: string | null) => Promise<void>;
  moveProductToNode: (id: string, nodeId: string) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  nodeImpact: (id: string) => Promise<{ folders: number; products: number }>;
  saveProduct: (draft: ProductDraft & { node_id: string }) => Promise<void>;
  quickCreate: (
    fromId: string | null,
    folders: FolderDraft[],
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
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CatalogNode | null>(null);
  const [editing, setEditing] = useState<{ product?: Product } | null>(null);
  const [quick, setQuick] = useState(false);
  const [formatChoice, setFormatChoice] = useState<Record<string, "keep" | "none">>({});
  const [drag, setDrag] = useState<
    { kind: "folder"; id: string; level: NodeLevel } | { kind: "product"; id: string } | null
  >(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
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
  const isLeaf = current ? canHoldProducts(current.level) : false;
  /** At Produit (3) the admin decides whether this product uses Formats at all. */
  const formatDecision: "keep" | "none" | "ask" | null =
    current && level === 3
      ? (formatChoice[current.id] ?? (folders.length > 0 ? "keep" : "ask"))
      : null;
  const canCreateFolder = level < 4 && formatDecision !== "none" && formatDecision !== "ask";
  /** Levels still to create: required down to Produit (3) + the optional Format (4). */
  const missingLevels = useMemo(
    () =>
      Array.from({ length: Math.max(0, 4 - level) }, (_, i) => (level + i + 1) as NodeLevel).filter(
        (l) => !(l === 4 && level === 3 && formatDecision !== "keep"),
      ),
    [level, formatDecision],
  );

  const optionalLevels = useMemo<NodeLevel[]>(() => [4], []);
  const products = useMemo(
    () => (isLeaf && current ? data.products.filter((p) => p.node_id === current.id) : []),
    [data.products, current, isLeaf],
  );

  const canDropOn = (targetId: string | null, targetLevel: 0 | NodeLevel) => {
    if (!drag) return false;
    if (drag.kind === "product") return targetId !== null && targetLevel >= 3;
    if (drag.id === targetId) return false;
    if (targetId && pathOf(data.nodes, targetId).some((n) => n.id === drag.id)) return false;
    const depth = (rootId: string): number => {
      const kids = childrenOf(data.nodes, rootId);
      return kids.length === 0 ? 1 : 1 + Math.max(...kids.map((k) => depth(k.id)));
    };
    return targetLevel + depth(drag.id) <= 4;
  };

  const handleDrop = async (targetId: string | null, targetLevel: 0 | NodeLevel) => {
    const item = drag;
    setDropTarget(null);
    setDrag(null);
    if (!item || !canDropOn(targetId, targetLevel)) return;
    setDragError(null);
    try {
      if (item.kind === "product") {
        if (targetId) await actions.moveProductToNode(item.id, targetId);
      } else {
        await actions.reparentNode(item.id, targetId);
      }
    } catch {
      setDragError("Déplacement impossible vers cet emplacement.");
    }
  };

  const dropProps = (targetId: string | null, targetLevel: 0 | NodeLevel) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDropOn(targetId, targetLevel)) return;
      e.preventDefault();
      setDropTarget(targetId ?? "root");
    },
    onDragLeave: () => setDropTarget((prev) => (prev === (targetId ?? "root") ? null : prev)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      void handleDrop(targetId, targetLevel);
    },
  });

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
          {...dropProps(null, 0)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold",
            currentId === null ? "bg-brand-soft text-brand-deep" : "hover:text-brand",
            dropTarget === "root" && "ring-2 ring-brand",
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
              {...dropProps(node.id, node.level)}
              className={cn(
                "rounded-full px-3 py-1 font-semibold",
                currentId === node.id ? "bg-brand-soft text-brand-deep" : "hover:text-brand",
                dropTarget === node.id && "ring-2 ring-brand",
              )}
            >
              {node.name}
            </button>
          </span>
        ))}
        {busy && <Loader2 className="ms-auto h-4 w-4 animate-spin text-brand" />}
      </nav>

      {drag && (
        <p className="rounded-2xl border border-brand/40 bg-brand-soft/50 px-5 py-3 text-sm font-medium text-brand-deep">
          Glissez sur un dossier (ou un fil d\u2019Ariane ci-dessus) pour d\u00e9placer
          {drag.kind === "product" ? " cet article." : " ce dossier."}
        </p>
      )}
      {dragError && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive">
          {dragError}
        </p>
      )}

      {current && formatDecision === "ask" && (
        <div className="rounded-3xl border border-brand/30 bg-brand-soft/40 p-5">
          <h4 className="font-semibold">Formats pour « {current.name} » ?</h4>
          <p className="mt-1.5 text-sm text-foreground/70">
            Le niveau Format est optionnel. Gardez-le si ce produit se décline en formats (ex.
            600L, Side by Side), ou supprimez-le pour ajouter les modèles directement ici.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFormatChoice((prev) => ({ ...prev, [current.id]: "keep" }))}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-brand)" }}
            >
              Garder les formats
            </button>
            <button
              type="button"
              onClick={() => setFormatChoice((prev) => ({ ...prev, [current.id]: "none" }))}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold"
            >
              Supprimer le format · aller aux modèles
            </button>
          </div>
        </div>
      )}

      {current && formatDecision === "none" && (
        <p className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-sm text-foreground/70">
          Sans format : les modèles sont ajoutés directement dans « {current.name} ».
          <button
            type="button"
            onClick={() =>
              setFormatChoice((prev) => {
                const next = { ...prev };
                delete next[current.id];
                return next;
              })
            }
            className="font-semibold text-brand hover:underline"
          >
            Rétablir les formats
          </button>
        </p>
      )}



      {canCreateFolder &&
        (creating ? (
          <NodeForm
            level={childLevel}
            onCancel={() => setCreating(false)}
            onSave={async (name, image) => {
              await actions.createNode(currentId, name, image);
              setCreating(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
          >
            <FolderPlus className="h-4 w-4" /> Nouveau dossier · {LEVEL_LABELS[childLevel]}
          </button>
        ))}

      {missingLevels.length > 0 &&
        (quick ? (
          <ProductForm
            nodeId=""
            folderLevels={missingLevels}
            optionalLevels={optionalLevels}
            onCancel={() => setQuick(false)}
            onSave={async (draft) => {
              await actions.quickCreate(currentId, draft.folders, draft);
              setQuick(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setQuick(true)}
            className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand-soft/60 px-5 py-2.5 text-sm font-semibold text-brand-deep hover:bg-brand-soft"
          >
            <Zap className="h-4 w-4" /> Ajout rapide · créer{" "}
            {missingLevels
              .map((l) => (optionalLevels.includes(l) ? `${LEVEL_LABELS[l]} (optionnel)` : LEVEL_LABELS[l]))
              .join(" → ")}{" "}
            + article
          </button>
        ))}

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

          if (renaming?.id === node.id) {
            return (
              <NodeForm
                key={node.id}
                node={node}
                level={node.level}
                onCancel={() => setRenaming(null)}
                onSave={async (name, image) => {
                  await actions.renameNode(node.id, name, image);
                  setRenaming(null);
                }}
              />
            );
          }

          return (
            <div
              key={node.id}
              draggable
              onDragStart={() => setDrag({ kind: "folder", id: node.id, level: node.level })}
              onDragEnd={() => {
                setDrag(null);
                setDropTarget(null);
              }}
              {...dropProps(node.id, node.level)}
              className={cn(
                "flex cursor-grab items-center gap-3 rounded-2xl border border-border bg-card p-4 active:cursor-grabbing",
                dropTarget === node.id && canDropOn(node.id, node.level) && "ring-2 ring-brand",
                drag?.kind === "folder" && drag.id === node.id && "opacity-50",
              )}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-soft text-brand-deep">
                {node.image_url ? (
                  <img src={node.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </span>
              <button
                type="button"
                onClick={() => setCurrentId(node.id)}
                className="min-w-0 flex-1 text-start"
              >
                <p className="truncate font-semibold">{node.name}</p>
                <p className="text-xs text-foreground/55">
                  {LEVEL_LABELS[node.level]} · {subCount} sous-dossier(s) · {count} produit(s)
                  {!node.image_url && " · sans image"}
                </p>
              </button>
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
                onClick={() => setRenaming(node)}
                aria-label="Modifier le dossier"
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
                draggable
                onDragStart={() => setDrag({ kind: "product", id: product.id })}
                onDragEnd={() => {
                  setDrag(null);
                  setDropTarget(null);
                }}
                className={cn(
                  "flex cursor-grab items-center gap-4 rounded-2xl border border-border p-4 active:cursor-grabbing",
                  drag?.kind === "product" && drag.id === product.id && "opacity-50",
                )}
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
