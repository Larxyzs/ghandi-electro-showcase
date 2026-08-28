import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import { CindyAgentChat } from "@/components/admin/cindy/CindyAgentChat";
import { useLiveEdit } from "@/lib/live-edit";
import { cn } from "@/lib/utils";

/**
 * Cindy, available on every page of the site for signed-in admins.
 * Same agent as in the admin dashboard — no need to leave the page.
 */
export function CindyDock() {
  const { admin } = useLiveEdit();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [large, setLarge] = useState(false);

  if (!admin) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 end-5 z-50 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.04]"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Sparkles className="h-4 w-4" /> Cindy
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed bottom-4 end-4 z-50 flex flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl",
            large
              ? "h-[min(88vh,880px)] w-[min(94vw,760px)]"
              : "h-[min(78vh,640px)] w-[min(94vw,420px)]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-brand-soft/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-deep">
              <Sparkles className="h-4 w-4" /> Cindy · {admin.username}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLarge((v) => !v)}
                aria-label={large ? "Réduire" : "Agrandir"}
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 hover:bg-background"
              >
                {large ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer Cindy"
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 hover:bg-background"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <CindyAgentChat onChanged={() => void router.invalidate()} />
          </div>
        </div>
      )}
    </>
  );
}
