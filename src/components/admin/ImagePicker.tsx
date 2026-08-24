import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export type ImageDraft = {
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

/** Upload-or-link image picker shared by folder and product forms. */
export function ImagePicker({
  initialPath,
  initialPreview,
  label = "Image",
  onChange,
  onError,
}: {
  initialPath?: string | null;
  initialPreview?: string | null;
  label?: string;
  onChange: (draft: ImageDraft) => void;
  onError?: (message: string | null) => void;
}) {
  const startsHttp = Boolean(initialPath?.startsWith("http"));
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);
  const [mode, setMode] = useState<"upload" | "url">(startsHttp ? "url" : "upload");
  const [url, setUrl] = useState(startsHttp ? (initialPath as string) : "");
  const fileRef = useRef<HTMLInputElement>(null);

  const field =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

  const onFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      onError?.("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setPreview(result);
      onChange({ imageData: result, imageName: file.name, imageUrl: null, removeImage: false });
      onError?.(null);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">{label}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "upload", label: "Téléverser" },
              { id: "url", label: "Lien" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={
                mode === option.id
                  ? "rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground/60 hover:border-brand hover:text-brand"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
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

        {mode === "upload" ? (
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
                  setUrl("");
                  onChange({ imageData: null, imageName: null, imageUrl: null, removeImage: true });
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
              value={url}
              placeholder="https://…/image.jpg"
              onChange={(e) => {
                const value = e.target.value;
                setUrl(value);
                setPreview(value.trim() ? value.trim() : null);
                onChange({
                  imageData: null,
                  imageName: null,
                  imageUrl: value.trim() || null,
                  removeImage: !value.trim(),
                });
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
