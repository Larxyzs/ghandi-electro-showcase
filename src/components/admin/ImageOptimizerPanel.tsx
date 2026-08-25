import { useState } from "react";
import { CheckCircle2, ImageOff, Loader2, RefreshCcw, Wand2, XCircle } from "lucide-react";
import { normalizeImage } from "@/lib/image-tools";

type OptimizerItem = {
  id: string;
  kind: "product" | "node";
  label: string;
  imageUrl: string | null;
};

type ItemStatus = "pending" | "running" | "done" | "skipped" | "error";

type ItemState = {
  status: ItemStatus;
  message?: string;
};

/**
 * Admin maintenance panel that batch-optimizes every existing catalog image
 * (products and folders/nodes) directly in the browser, sequentially.
 */
export function ImageOptimizerPanel({
  items,
  onOptimized,
}: {
  items: OptimizerItem[];
  onOptimized: (item: { id: string; kind: "product" | "node" }, dataUrl: string, name: string) => Promise<void>;
}) {
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);

  const withImage = items.filter((item) => item.imageUrl);
  const total = items.length;
  const eligible = withImage.length;

  const setState = (id: string, state: ItemState) => {
    setStates((prev) => ({ ...prev, [id]: state }));
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    setStates({});

    for (const item of items) {
      const key = `${item.kind}:${item.id}`;
      if (!item.imageUrl) {
        setState(key, { status: "skipped", message: "Aucune image" });
        continue;
      }

      setState(key, { status: "running" });
      try {
        const result = await normalizeImage(item.imageUrl);
        if (!result.changed) {
          setState(key, { status: "skipped", message: "Déjà optimisée" });
          continue;
        }
        await onOptimized({ id: item.id, kind: item.kind }, result.dataUrl, result.name);
        setState(key, { status: "done", message: `${result.width}×${result.height}` });
      } catch (error) {
        const isCors =
          error instanceof Error && /charger|accès|CORS|externe/i.test(error.message);
        setState(key, {
          status: "error",
          message: isCors ? "Image externe non accessible" : error instanceof Error ? error.message : "Échec",
        });
      }
    }

    setRunning(false);
  };

  const iconFor = (status: ItemStatus | undefined) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />;
      case "done":
        return <CheckCircle2 className="h-3.5 w-3.5 text-brand" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case "skipped":
        return <ImageOff className="h-3.5 w-3.5 text-foreground/40" />;
      default:
        return <span className="h-3.5 w-3.5 rounded-full border border-border" />;
    }
  };

  const labelFor = (status: ItemStatus | undefined) => {
    switch (status) {
      case "running":
        return "Optimisation…";
      case "done":
        return "Optimisée";
      case "error":
        return "Erreur";
      case "skipped":
        return "Ignorée";
      default:
        return "En attente";
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
            Optimisation des images
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            {eligible} image{eligible > 1 ? "s" : ""} sur {total} élément{total > 1 ? "s" : ""} à corriger et
            redimensionner (1200×1200).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={running || eligible === 0}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-brand)" }}
        >
          {running ? (
            <RefreshCcw className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Tout optimiser
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => {
            const key = `${item.kind}:${item.id}`;
            const state = states[key];
            return (
              <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  {iconFor(state?.status)}
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="shrink-0 text-xs text-foreground/55">
                  {state?.message ?? labelFor(state?.status)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
