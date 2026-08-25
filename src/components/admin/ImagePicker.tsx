import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { normalizeImage } from "@/lib/image-tools";

type ImageVerdict = {
  verdict: "good" | "warn" | "bad";
  summary: string;
  issues: string[];
  advice: string;
};

/** Reads intrinsic pixel size so Cindy can judge resolution and scale. */
function measure(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

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
  const [dragging, setDragging] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<ImageVerdict | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [optimizedNote, setOptimizedNote] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const checkToken = useRef(0);
  const lastSourceRef = useRef<{ raw: string; kind: "data" | "url" } | null>(null);

  /** Asks Cindy to confirm the image is a clean, well-scaled product shot. */
  const checkImage = async (source: string) => {
    const token = ++checkToken.current;
    setChecking(true);
    setVerdict(null);
    setCheckError(null);
    try {
      const size = await measure(source);
      const res = await fetch("/api/admin/check-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(source.startsWith("data:") ? { imageData: source } : { imageUrl: source }),
          ...(size ?? {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as (ImageVerdict & { error?: string }) | null;
      if (token !== checkToken.current) return;
      if (!res.ok || !data || data.error) {
        setCheckError(data?.error ?? "Vérification de l'image impossible.");
        return;
      }
      setVerdict({
        verdict: data.verdict,
        summary: data.summary,
        issues: data.issues ?? [],
        advice: data.advice ?? "",
      });
    } catch {
      if (token === checkToken.current) setCheckError("Vérification de l'image impossible.");
    } finally {
      if (token === checkToken.current) setChecking(false);
    }
  };

  const clearCheck = () => {
    checkToken.current++;
    setChecking(false);
    setVerdict(null);
    setCheckError(null);
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

  const applyNormalizedData = (
    result: { dataUrl: string; name: string; width: number; height: number; changed: boolean },
  ) => {
    setPreview(result.dataUrl);
    setOptimizedNote(result.changed ? `Image optimisée · ${result.width}×${result.height}` : null);
    onChange({ imageData: result.dataUrl, imageName: result.name, imageUrl: null, removeImage: false });
    onError?.(null);
    lastSourceRef.current = { raw: result.dataUrl, kind: "data" };
    void checkImage(result.dataUrl);
  };

  const onFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      onError?.("Image trop volumineuse (5 Mo maximum).");
      return;
    }
    try {
      const result = await normalizeImage(file);
      applyNormalizedData(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Impossible de traiter cette image.");
    }
  };

  const onUrlCommitted = async (value: string) => {
    if (!/^https?:\/\//.test(value)) return;
    try {
      const result = await normalizeImage(value);
      setOptimizedNote(result.changed ? `Image optimisée · ${result.width}×${result.height}` : null);
      lastSourceRef.current = { raw: result.dataUrl, kind: "data" };
      onChange({ imageData: result.dataUrl, imageName: result.name, imageUrl: null, removeImage: false });
      onError?.(null);
      void checkImage(result.dataUrl);
    } catch {
      // Likely a CORS-restricted remote image: keep the URL as-is.
      setOptimizedNote("Image externe non optimisée (accès restreint) — lien conservé tel quel.");
      lastSourceRef.current = { raw: value, kind: "url" };
      void checkImage(value);
    }
  };

  const runAutoFix = async () => {
    const current = lastSourceRef.current;
    const source = current?.raw ?? preview;
    if (!source) return;
    setFixing(true);
    try {
      const result = await normalizeImage(source);
      applyNormalizedData(result);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Correction automatique impossible.");
    } finally {
      setFixing(false);
    }
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
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = Array.from(e.dataTransfer.files).find((f) =>
                f.type.startsWith("image/"),
              );
              if (file) void onFile(file);
              else onError?.("Déposez un fichier image (JPG, PNG, WebP…).");
            }}
            onPaste={(e) => {
              const file = Array.from(e.clipboardData.files).find((f) =>
                f.type.startsWith("image/"),
              );
              if (file) {
                e.preventDefault();
                void onFile(file);
              }
            }}
            className={`flex flex-1 flex-wrap items-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
              dragging ? "border-brand bg-brand-soft/60" : "border-border"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
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
            <span className="text-xs text-foreground/55">
              ou glissez-déposez / collez une image ici
            </span>
            {preview && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setUrl("");
                  setOptimizedNote(null);
                  lastSourceRef.current = null;
                  clearCheck();
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
                setOptimizedNote(null);
                lastSourceRef.current = value.trim() ? { raw: value.trim(), kind: "url" } : null;
                clearCheck();
                onChange({
                  imageData: null,
                  imageName: null,
                  imageUrl: value.trim() || null,
                  removeImage: !value.trim(),
                });
              }}
              onBlur={() => {
                const value = url.trim();
                if (value) void onUrlCommitted(value);
              }}
            />
          </label>
        )}
      </div>

      {preview && (
        <div className="mt-3 space-y-2">
          {optimizedNote && (
            <p className="text-xs font-medium text-brand-deep">{optimizedNote}</p>
          )}

          {checking && (
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Cindy vérifie l'image
              (netteté, cadrage, échelle)…
            </p>
          )}

          {!checking && verdict && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                verdict.verdict === "good"
                  ? "border-brand/30 bg-brand-soft/40 text-brand-deep"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              <p className="flex items-center gap-2 font-semibold">
                {verdict.verdict === "good" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {verdict.summary}
              </p>
              {verdict.issues.length > 0 && (
                <ul className="mt-1.5 space-y-1 ps-5 list-disc">
                  {verdict.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              {verdict.advice && <p className="mt-1.5 opacity-80">{verdict.advice}</p>}
            </div>
          )}

          {!checking && checkError && (
            <p className="text-xs font-semibold text-foreground/55">{checkError}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!checking && (
              <button
                type="button"
                onClick={() => {
                  const source = preview;
                  if (source) void checkImage(source);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-foreground/70 hover:border-brand hover:text-brand"
              >
                <Sparkles className="h-3.5 w-3.5" /> {verdict || checkError ? "Revérifier" : "Vérifier avec Cindy"}
              </button>
            )}

            {!checking && verdict && (verdict.verdict === "warn" || verdict.verdict === "bad") && (
              <button
                type="button"
                onClick={() => void runAutoFix()}
                disabled={fixing}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {fixing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Corriger automatiquement
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
