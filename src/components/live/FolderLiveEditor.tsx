import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CopyPlus, FolderPlus, ImagePlus, Link2, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminAttachProductBySerial,
  adminCreateNode,
  adminDeleteNode,
  adminRenameNode,
} from "@/lib/admin.functions";
import {
  canHoldProducts,
  LEVEL_LABELS,
  MAX_LEVEL,
  type CatalogNode,
  type NodeLevel,
} from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

const readFile = (file: File) =>
  new Promise<{ imageData: string; imageName: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ imageData: String(reader.result), imageName: file.name });
    reader.onerror = () => reject(new Error("READ_ERROR"));
    reader.readAsDataURL(file);
  });

/**
 * On-page folder editor: rename the current rayon, swap its image (upload,
 * drag & drop or link), add a sub-rayon, or delete it — without leaving the site.
 */
export function FolderLiveEditor({ node }: { node: CatalogNode | null }) {
  const router = useRouter();
  const rename = useServerFn(adminRenameNode);
  const create = useServerFn(adminCreateNode);
  const remove = useServerFn(adminDeleteNode);
  const attach = useServerFn(adminAttachProductBySerial);

  const [name, setName] = useState(node?.name ?? "");
  const [imageUrl, setImageUrl] = useState(node?.image_path?.startsWith("http") ? node.image_path : "");
  const [upload, setUpload] = useState<{ imageData: string; imageName: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(node?.image_url ?? null);
  const [childName, setChildName] = useState("");
  const [serialDraft, setSerialDraft] = useState("");
  const [busy, setBusy] = useState<"save" | "child" | "delete" | "attach" | null>(null);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const childLevel = ((node?.level ?? 0) + 1) as NodeLevel;
  const canAddChild = childLevel <= MAX_LEVEL;
  const canAttachProduct = Boolean(node && canHoldProducts(node.level));

  /** Lists an existing product here by reference — same fiche, no duplicate. */
  const attachBySerial = async () => {
    if (!node || !serialDraft.trim()) return;
    setBusy("attach");
    try {
      const result = await attach({ data: { serial: serialDraft.trim(), nodeId: node.id } });
      setSerialDraft("");
      await router.invalidate();
      toast.success(`« ${result.name} » ajouté à cette catégorie`);
    } catch (error) {
      toast.error(
        String((error as Error)?.message).includes("PRODUCT_NOT_FOUND")
          ? "Aucun produit avec cette référence."
          : "Ajout impossible",
      );
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (5 Mo max).");
      return;
    }
    const data = await readFile(file);
    setUpload(data);
    setPreview(data.imageData);
    setImageUrl("");
  };

  const saveNode = async () => {
    if (!node) return;
    if (!name.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    setBusy("save");
    try {
      const image = upload
        ? { imageData: upload.imageData, imageName: upload.imageName }
        : imageUrl.trim()
          ? { imageUrl: imageUrl.trim() }
          : null;
      await rename({
        data: { id: node.id, name: name.trim(), ...(image ? { image } : {}) },
      });
      await router.invalidate();
      toast.success("Rayon mis à jour");
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setBusy(null);
    }
  };

  const addChild = async () => {
    if (!childName.trim()) return;
    setBusy("child");
    try {
      await create({ data: { parentId: node?.id ?? null, name: childName.trim() } });
      setChildName("");
      await router.invalidate();
      toast.success("Rayon créé");
    } catch {
      toast.error("Création impossible");
    } finally {
      setBusy(null);
    }
  };

  const deleteNode = async () => {
    if (!node) return;
    if (!window.confirm(`Supprimer « ${node.name} » et tout son contenu ?`)) return;
    setBusy("delete");
    try {
      await remove({ data: { id: node.id } });
      toast.success("Rayon supprimé");
      await router.navigate({ to: "/produits" });
    } catch {
      toast.error("Suppression impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 rounded-3xl border-2 border-dashed border-brand/50 bg-brand-soft/25 p-5">
      <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-brand-deep uppercase">
        Édition directe {node ? `· ${LEVEL_LABELS[node.level]}` : "· Catégories"}
      </p>

      {node && (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
              setDropping(true);
            }
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            const file = e.dataTransfer.files[0];
            if (file) {
              e.preventDefault();
              setDropping(false);
              void pickFile(file);
            }
          }}
          className={cn(
            "mt-4 grid gap-4 rounded-2xl border border-dashed p-4 sm:grid-cols-[140px_1fr]",
            dropping ? "border-brand bg-brand-soft/60" : "border-border bg-background/70",
          )}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-background"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-[0.7rem] font-semibold text-foreground/55">
                <ImagePlus className="h-5 w-5" /> Image
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void pickFile(file);
              e.target.value = "";
            }}
          />

          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Nom
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Link2 className="h-4 w-4 text-foreground/50" />
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setUpload(null);
                  if (e.target.value.startsWith("https://")) setPreview(e.target.value);
                }}
                placeholder="https://… lien d'image"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === "save"}
                onClick={() => void saveNode()}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                style={{ background: "var(--gradient-brand)" }}
              >
                {busy === "save" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() => void deleteNode()}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/50 px-4 py-2.5 text-sm font-semibold text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {canAttachProduct && (
        <div className="mt-4">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand-deep uppercase">
            Ajouter un produit existant (par référence)
          </p>
          <p className="mt-1 text-xs text-foreground/60">
            Le même produit apparaît dans plusieurs catégories, avec une seule fiche.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={serialDraft}
              onChange={(e) => setSerialDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void attachBySerial();
                }
              }}
              placeholder="Référence du produit"
              className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy === "attach" || !serialDraft.trim()}
              onClick={() => void attachBySerial()}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:border-brand hover:text-brand disabled:opacity-50"
            >
              {busy === "attach" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CopyPlus className="h-4 w-4" />
              )}
              Ajouter ici
            </button>
          </div>
        </div>
      )}

      {canAddChild && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addChild();
              }
            }}
            placeholder={`Nouveau ${LEVEL_LABELS[childLevel]}`}
            className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy === "child" || !childName.trim()}
            onClick={() => void addChild()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {busy === "child" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4" />
            )}
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
