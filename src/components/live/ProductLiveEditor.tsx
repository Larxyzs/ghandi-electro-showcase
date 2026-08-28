import { useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  GripVertical,
  ImagePlus,
  Link2,
  Loader2,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminSaveProduct } from "@/lib/admin.functions";
import { canHoldProducts, pathOf, type CatalogNode, type Product } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

type Slide = {
  key: string;
  /** Stored value (storage path or https URL); empty for a brand-new upload. */
  value: string;
  preview: string;
  upload?: { imageData: string; imageName: string };
};

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("READ_ERROR"));
    reader.readAsDataURL(file);
  });

/**
 * On-page product editor for admins: rename, price/stock, category, and full
 * slideshow management (drag to reorder, drop files, paste links, remove).
 */
export function ProductLiveEditor({
  product,
  nodes,
  onClose,
}: {
  product: Product;
  nodes: CatalogNode[];
  onClose: () => void;
}) {
  const router = useRouter();
  const save = useServerFn(adminSaveProduct);

  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [serial, setSerial] = useState(product.serial_number ?? "");
  const [stock, setStock] = useState(String(product.stock ?? 0));
  const [price, setPrice] = useState(product.price === null ? "" : String(product.price));
  const [characteristics, setCharacteristics] = useState(product.characteristics ?? "");
  const [featured, setFeatured] = useState(product.featured);
  const [nodeId, setNodeId] = useState(product.node_id);
  const [urlDraft, setUrlDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [slides, setSlides] = useState<Slide[]>(() => {
    const raw = product.gallery_paths ?? product.gallery ?? [];
    const shown = product.gallery ?? [];
    return raw.map((value, index) => ({
      key: `${index}-${value}`,
      value,
      preview: value.startsWith("http") ? value : (shown[index] ?? ""),
    }));
  });

  const folders = useMemo(
    () =>
      nodes
        .filter((node) => canHoldProducts(node.level))
        .map((node) => ({
          id: node.id,
          label: pathOf(nodes, node.id)
            .map((n) => n.name)
            .join(" › "),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "fr")),
    [nodes],
  );

  const addFiles = async (files: File[]) => {
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`« ${file.name} » dépasse 5 Mo.`);
        continue;
      }
      const data = await readFile(file);
      setSlides((prev) => [
        ...prev,
        {
          key: `${Date.now()}-${file.name}`,
          value: "",
          preview: data,
          upload: { imageData: data, imageName: file.name },
        },
      ]);
    }
  };

  const addUrl = (raw: string) => {
    const url = raw.trim();
    if (!/^https:\/\/\S+$/i.test(url)) {
      toast.error("Lien invalide (https:// requis).");
      return;
    }
    setSlides((prev) => [...prev, { key: `${Date.now()}-${url}`, value: url, preview: url }]);
    setUrlDraft("");
  };

  const move = (from: number, to: number) => {
    setSlides((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    setBusy(true);
    try {
      const gallery = slides
        .map((slide) => (slide.upload ? slide.upload : slide.value.trim()))
        .filter((entry) => (typeof entry === "string" ? entry.length > 0 : true));
      const parsedPrice = price.trim() === "" ? null : Number(price.replace(",", "."));
      await save({
        data: {
          id: product.id,
          node_id: nodeId,
          name: name.trim(),
          brand: brand.trim(),
          serial_number: serial.trim(),
          stock: Math.max(0, Math.floor(Number(stock) || 0)),
          price: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
          characteristics,
          featured,
          gallery,
        },
      });
      await router.invalidate();
      toast.success("Produit mis à jour");
      onClose();
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 rounded-3xl border-2 border-dashed border-brand/50 bg-brand-soft/25 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-brand-deep uppercase">
          Édition directe
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'édition"
          className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Nom
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Marque
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Référence
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Prix (MAD)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="—"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium">
          Stock
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Catégorie / emplacement
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Caractéristiques
          <textarea
            value={characteristics}
            onChange={(e) => setCharacteristics(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => setFeatured((v) => !v)}
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors",
            featured
              ? "border-brand bg-brand-soft text-brand-deep"
              : "border-border text-foreground/70",
          )}
        >
          <Star className={cn("h-4 w-4", featured && "fill-current")} /> Modèle en vedette
        </button>
      </div>

      {/* Slideshow */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDropping(true);
          }
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={(e) => {
          if (e.dataTransfer.files.length) {
            e.preventDefault();
            setDropping(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.startsWith("https://")) addUrl(text);
        }}
        className={cn(
          "mt-6 rounded-2xl border border-dashed p-4 transition-colors",
          dropping ? "border-brand bg-brand-soft/60" : "border-border bg-background/70",
        )}
      >
        <p className="text-sm font-semibold">
          Diaporama — glissez pour réordonner, déposez des images ou collez un lien
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {slides.map((slide, index) => (
            <div
              key={slide.key}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-background",
                dragIndex === index ? "border-brand opacity-60" : "border-border",
              )}
            >
              {slide.preview ? (
                <img
                  src={slide.preview}
                  alt=""
                  className="h-full w-full object-contain p-1.5"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[0.65rem] text-foreground/50">
                  image
                </div>
              )}
              <span className="absolute start-1 top-1 rounded-full bg-background/85 px-1.5 text-[0.65rem] font-semibold">
                {index + 1}
              </span>
              <GripVertical className="absolute end-1 top-1 h-3.5 w-3.5 text-foreground/40" />
              <button
                type="button"
                onClick={() => setSlides((prev) => prev.filter((_, i) => i !== index))}
                aria-label="Supprimer cette image"
                className="absolute end-1 bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/90 text-[oklch(1_0_0)] opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[0.7rem] font-semibold text-foreground/60 hover:border-brand hover:text-brand"
          >
            <ImagePlus className="h-5 w-5" /> Ajouter
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Link2 className="h-4 w-4 text-foreground/50" />
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl(urlDraft);
                }
              }}
              placeholder="https://… lien d'image"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => addUrl(urlDraft)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand"
          >
            Ajouter le lien
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-60"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
