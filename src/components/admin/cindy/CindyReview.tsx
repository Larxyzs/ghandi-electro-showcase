import { useMemo, useState } from "react";
import { BadgeCheck, Check, Globe, Loader2, ShieldCheck, X } from "lucide-react";
import type { ResearchedProduct } from "@/lib/cindy-types";
import type { CatalogNode, SiteData } from "@/lib/catalog-types";
import { canHoldProducts, pathOf } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export type CindyImportPayload = {
  node_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  characteristics: string;
  specifications: { label: string; value: string }[];
  gallery: string[];
  marketing_sections: unknown[];
  imageUrl: string | null;
  source_url: string | null;
  source_name: string | null;
};

export function CindyReview({
  product,
  data,
  defaultNodeId,
  onCancel,
  onImport,
}: {
  product: ResearchedProduct;
  data: SiteData;
  defaultNodeId?: string | null;
  onCancel: () => void;
  onImport: (payload: CindyImportPayload) => Promise<void>;
}) {
  const leaves = useMemo(
    () => data.nodes.filter((n: CatalogNode) => canHoldProducts(n.level)),
    [data.nodes],
  );

  const [nodeId, setNodeId] = useState<string>(defaultNodeId ?? leaves[0]?.id ?? "");
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand);
  const [reference, setReference] = useState(product.model);
  const [characteristics, setCharacteristics] = useState(product.characteristics);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [images, setImages] = useState<string[]>(product.images);
  const [cover, setCover] = useState<string | null>(product.images[0] ?? null);
  const [specs, setSpecs] = useState(product.specifications);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const official = product.sources.find((s) => s.official) ?? product.sources[0] ?? null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nodeId) {
      setError("Choisissez un dossier de destination.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onImport({
        node_id: nodeId,
        name: name.trim(),
        brand: brand.trim(),
        serial_number: reference.trim(),
        stock: Number(stock) || 0,
        price: price.trim() === "" ? null : Number(price),
        characteristics,
        specifications: specs,
        gallery: images.filter((img) => img !== cover),
        marketing_sections: product.marketing_sections as unknown[],
        imageUrl: cover,
        source_url: official?.url ?? null,
        source_name: official?.name ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-3xl border border-border bg-background"
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            Produit trouvé
          </p>
          <h3 className="font-display mt-1 text-xl font-semibold">{product.name}</h3>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            product.confidence === "high"
              ? "bg-brand-soft text-brand"
              : product.confidence === "medium"
                ? "bg-[oklch(0.95_0.06_85)] text-[oklch(0.45_0.12_75)]"
                : "bg-destructive/10 text-destructive",
          )}
        >
          Confiance : {product.confidence}
        </span>
      </header>

      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-card">
            {cover ? (
              <img src={cover} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-foreground/40">
                Aucune image
              </div>
            )}
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img} className="group relative">
                  <button
                    type="button"
                    onClick={() => setCover(img)}
                    className={cn(
                      "aspect-square w-full overflow-hidden rounded-xl border bg-card",
                      cover === img ? "border-brand ring-2 ring-brand/30" : "border-border",
                    )}
                  >
                    <img src={img} alt="" className="h-full w-full object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImages((prev) => prev.filter((i) => i !== img));
                      if (cover === img) setCover(images.find((i) => i !== img) ?? null);
                    }}
                    className="absolute -end-1.5 -top-1.5 hidden rounded-full bg-background p-1 text-destructive shadow group-hover:block"
                    aria-label="Retirer l'image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {official && (
            <a
              href={official.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm hover:border-brand"
            >
              {official.official ? (
                <BadgeCheck className="h-4 w-4 text-brand" />
              ) : (
                <Globe className="h-4 w-4 text-foreground/50" />
              )}
              <span className="truncate">{official.name}</span>
              <span className="ms-auto text-xs text-foreground/50">
                {official.official ? "Officiel" : "Source"}
              </span>
            </a>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dossier de destination" full>
              <select
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
              >
                <option value="">— Choisir —</option>
                {leaves.map((node) => (
                  <option key={node.id} value={node.id}>
                    {pathOf(data.nodes, node.id)
                      .map((n) => n.name)
                      .join(" › ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marque">
              <Input value={brand} onChange={setBrand} />
            </Field>
            <Field label="Référence / modèle">
              <Input value={reference} onChange={setReference} />
            </Field>
            <Field label="Nom" full>
              <Input value={name} onChange={setName} />
            </Field>
          </div>

          <div className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" /> Informations commerciales — saisies par vous
              uniquement
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Prix (MAD)">
                <Input value={price} onChange={setPrice} placeholder="Ex. 6499" type="number" />
              </Field>
              <Field label="Stock">
                <Input value={stock} onChange={setStock} type="number" />
              </Field>
            </div>
          </div>

          <Field label="Caractéristiques" full>
            <textarea
              value={characteristics}
              onChange={(e) => setCharacteristics(e.target.value)}
              rows={7}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </Field>

          {specs.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                Spécifications
              </p>
              <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                {specs.map((spec, index) => (
                  <div key={`${spec.label}-${index}`} className="flex items-center gap-3 px-4 py-2">
                    <span className="w-2/5 truncate text-xs text-foreground/60">{spec.label}</span>
                    <input
                      value={spec.value}
                      onChange={(e) =>
                        setSpecs((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, value: e.target.value } : s)),
                        )
                      }
                      className="flex-1 bg-transparent text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== index))}
                      className="text-foreground/35 hover:text-destructive"
                      aria-label="Retirer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.notes && <p className="text-xs text-foreground/55">{product.notes}</p>}
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              style={{ background: "var(--gradient-brand)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Créer le produit
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold hover:border-brand"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block text-sm", full ? "sm:col-span-2" : "")}>
      <span className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      type={type ?? "text"}
      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
    />
  );
}
