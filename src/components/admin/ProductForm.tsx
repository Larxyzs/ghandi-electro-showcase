import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { LEVEL_LABELS, type NodeLevel, type Product } from "@/lib/catalog-types";
import { BRAND_NAMES } from "@/lib/brands";

export type ProductDraft = {
  id?: string | undefined;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: string;
  description: string;
  imageData?: string | null | undefined;
  imageName?: string | null | undefined;
  imageUrl?: string | null | undefined;
  removeImage?: boolean | undefined;
};

export function ProductForm({
  product,
  nodeId,
  folderLevels,
  optionalLevels,
  onCancel,
  onSave,
}: {
  product?: Product;
  nodeId: string;
  /** Quick-jump: folder levels to create on the fly before saving the product. */
  folderLevels?: NodeLevel[];
  /** Subset of folderLevels that may be left empty (e.g. the optional Format). */
  optionalLevels?: NodeLevel[];
  onCancel: () => void;
  onSave: (draft: ProductDraft & { node_id: string; folders: string[] }) => Promise<void>;
}) {
  const [folders, setFolders] = useState<string[]>(() => (folderLevels ?? []).map(() => ""));
  const [draft, setDraft] = useState<ProductDraft>({
    id: product?.id,
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    serial_number: product?.serial_number ?? "",
    stock: product?.stock ?? 0,
    price: product?.price === null || product?.price === undefined ? "" : String(product.price),
    description: product?.description ?? "",
  });
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [imageMode, setImageMode] = useState<"upload" | "url">(
    product?.image_path?.startsWith("http") ? "url" : "upload",
  );
  const [imageUrl, setImageUrl] = useState(
    product?.image_path?.startsWith("http") ? product.image_path : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const onFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPreview(result);
      setDraft((d) => ({
        ...d,
        imageData: result,
        imageName: file.name,
        imageUrl: null,
        removeImage: false,
      }));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const field = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft.name.trim()) {
          setError("Le nom est obligatoire.");
          return;
        }
        const levels = folderLevels ?? [];
        const isOptional = (level: NodeLevel) => (optionalLevels ?? []).includes(level);
        if (levels.some((level, i) => !isOptional(level) && !(folders[i] ?? "").trim())) {
          setError("Renseignez tous les dossiers obligatoires à créer.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await onSave({
            ...draft,
            node_id: nodeId,
            folders: folders.map((n) => n.trim()).filter(Boolean),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Enregistrement impossible.");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-2xl border border-brand/30 bg-brand-soft/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">{product ? "Modifier l'article" : "Nouvel article"}</h4>
        <button type="button" onClick={onCancel} aria-label="Fermer" className="text-foreground/50 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {folderLevels && folderLevels.length > 0 && (
        <div className="mt-5 grid gap-4 rounded-2xl border border-dashed border-brand/40 bg-background p-4 sm:grid-cols-2">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase sm:col-span-2">
            Dossiers à créer
          </p>
          {folderLevels.map((level, index) => (
            <label key={level} className="text-sm font-medium">
              {LEVEL_LABELS[level]}
              {(optionalLevels ?? []).includes(level) && (
                <span className="ms-1.5 text-xs font-normal text-foreground/50">(optionnel)</span>
              )}
              <input
                className={`mt-1.5 ${field}`}
                value={folders[index] ?? ""}
                onChange={(e) =>
                  setFolders((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
                }
                placeholder={`Nom du ${LEVEL_LABELS[level].toLowerCase()}`}
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Nom
          <input className={`mt-1.5 ${field}`} value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Marque
          <input
            className={`mt-1.5 ${field}`}
            list="ghe-brands"
            value={draft.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="ex. Samsung"
          />
          <datalist id="ghe-brands">
            {BRAND_NAMES.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium">
          Numéro de série
          <input
            className={`mt-1.5 ${field}`}
            value={draft.serial_number}
            onChange={(e) => set("serial_number", e.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Quantité en stock
          <input
            type="number"
            min={0}
            className={`mt-1.5 ${field}`}
            value={draft.stock}
            onChange={(e) => set("stock", Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="text-sm font-medium">
          Prix (MAD, optionnel)
          <input
            type="number"
            min={0}
            step="0.01"
            className={`mt-1.5 ${field}`}
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium">
        Description / caractéristiques
        <textarea
          rows={4}
          className={`mt-1.5 ${field}`}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <div className="mt-5 rounded-2xl border border-border bg-background p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "upload", label: "Téléverser un fichier" },
              { id: "url", label: "Utiliser un lien" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setImageMode(option.id)}
              className={
                imageMode === option.id
                  ? "rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground/60 hover:border-brand hover:text-brand"
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-foreground/30">
                <ImagePlus className="h-6 w-6" />
              </div>
            )}
          </div>

          {imageMode === "upload" ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand"
              >
                Choisir une image
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setImageUrl("");
                    setDraft((d) => ({
                      ...d,
                      imageData: null,
                      imageName: null,
                      imageUrl: null,
                      removeImage: true,
                    }));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
              )}
            </div>
          ) : (
            <label className="flex-1 text-sm font-medium">
              Lien de l'image (https)
              <input
                className={`mt-1.5 ${field}`}
                value={imageUrl}
                placeholder="https://…/image.jpg"
                onChange={(e) => {
                  const value = e.target.value;
                  setImageUrl(value);
                  setPreview(value.trim() ? value.trim() : null);
                  setDraft((d) => ({
                    ...d,
                    imageData: null,
                    imageName: null,
                    imageUrl: value.trim() || null,
                    removeImage: value.trim() ? false : true,
                  }));
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}