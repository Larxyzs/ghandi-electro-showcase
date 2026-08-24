import { useState } from "react";
import { FolderPlus, Loader2, X } from "lucide-react";
import { LEVEL_LABELS, type CatalogNode, type NodeLevel } from "@/lib/catalog-types";
import { ImagePicker, type ImageDraft } from "@/components/admin/ImagePicker";

/** Create or edit a catalog folder (any of the 4 levels), with its image. */
export function NodeForm({
  node,
  level,
  onCancel,
  onSave,
}: {
  node?: CatalogNode;
  level: NodeLevel;
  onCancel: () => void;
  onSave: (name: string, image: ImageDraft) => Promise<void>;
}) {
  const [name, setName] = useState(node?.name ?? "");
  const [image, setImage] = useState<ImageDraft>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Le nom est obligatoire.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await onSave(name.trim(), image);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Enregistrement impossible.");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-3xl border border-brand/30 bg-brand-soft/40 p-5"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">
          {node ? `Modifier · ${LEVEL_LABELS[level]}` : `Nouveau dossier · ${LEVEL_LABELS[level]}`}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fermer"
          className="text-foreground/50 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-4 block text-sm font-medium">
        Nom
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Nom du ${LEVEL_LABELS[level].toLowerCase()}`}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
        />
      </label>

      <div className="mt-4">
        <ImagePicker
          initialPath={node?.image_path ?? null}
          initialPreview={node?.image_url ?? null}
          label="Image du dossier"
          onChange={setImage}
          onError={setError}
        />
        <p className="mt-2 text-xs text-foreground/55">
          Sans image, une icône est affichée à la place sur le site.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}{" "}
          Enregistrer
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
