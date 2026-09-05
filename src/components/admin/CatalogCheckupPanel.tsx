import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, ShieldCheck, Wrench } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminFreezeReferences,
  adminListReferences,
  adminRebuildChunk,
  adminRebuildState,
  adminRepairAudit,
  adminRunCatalogAudit,
  adminStartRebuild,
} from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

type Finding = {
  id?: string;
  product_label: string;
  model: string;
  problem: string;
  evidence: string;
  severity: string;
  action: string;
  auto_repair_safe: boolean;
  source_url?: string | null;
};

type AuditResult = {
  id: string;
  summary: { checked: number; verified: number; needs_review: number; incorrect: number };
  report: string;
  deep_checked: number;
  findings: Finding[];
};

type Progress = {
  id: string;
  state: string;
  total: number;
  processed: number;
  verified: number;
  needs_review: number;
  failed: number;
  references_preserved: number;
  products_deleted: number;
  remaining?: number;
  done?: boolean;
} | null;

const severityStyle: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-700",
  medium: "bg-brand-soft text-brand",
  low: "bg-muted text-foreground/70",
};

export function CatalogCheckupPanel({ isSuper }: { isSuper: boolean }) {
  const runAudit = useServerFn(adminRunCatalogAudit);
  const repair = useServerFn(adminRepairAudit);
  const freeze = useServerFn(adminFreezeReferences);
  const listRefs = useServerFn(adminListReferences);
  const startRebuild = useServerFn(adminStartRebuild);
  const rebuildChunk = useServerFn(adminRebuildChunk);
  const rebuildState = useServerFn(adminRebuildState);

  const [busy, setBusy] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [deep, setDeep] = useState(true);
  const [references, setReferences] = useState(0);
  const [progress, setProgress] = useState<Progress>(null);
  const [message, setMessage] = useState("");

  const loadReferences = useCallback(async () => {
    const list = (await listRefs({ data: { limit: 1000 } })) as unknown[];
    setReferences(list.length);
  }, [listRefs]);

  useEffect(() => {
    void loadReferences();
    void rebuildState({ data: { jobId: "", state: "" } }).then((job) => setProgress((job as Progress) ?? null));
  }, [loadReferences, rebuildState]);

  const doAudit = async () => {
    setBusy("audit");
    setMessage("");
    try {
      const result = (await runAudit({ data: { deep, deepLimit: 40 } })) as AuditResult;
      setAudit(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Contrôle impossible.");
    } finally {
      setBusy("");
    }
  };

  const doRepair = async () => {
    if (!audit?.id) return;
    setBusy("repair");
    try {
      const result = (await repair({ data: { runId: audit.id, limit: 50 } })) as {
        repaired: number;
        skipped: number;
      };
      setMessage(`${result.repaired} réparation(s) sûre(s) appliquée(s), ${result.skipped} laissée(s) à revoir.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Réparation impossible.");
    } finally {
      setBusy("");
    }
  };

  const doFreeze = async () => {
    setBusy("freeze");
    try {
      const result = (await freeze(undefined as never)) as { total: number };
      setMessage(`Liste maîtresse à jour : ${result.total} référence(s) conservée(s) définitivement.`);
      await loadReferences();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sauvegarde impossible.");
    } finally {
      setBusy("");
    }
  };

  const doRebuild = async () => {
    if (!confirm("Les articles actuels seront supprimés puis refaits depuis les pages officielles. La liste maîtresse est conservée. Continuer ?"))
      return;
    setBusy("rebuild");
    try {
      const job = (await startRebuild({ data: { deleteProducts: true } })) as NonNullable<Progress>;
      setProgress(job);
      await loadReferences();
      let current = job;
      while (current && !current.done && current.processed < current.total) {
        current = (await rebuildChunk({ data: { jobId: job.id, size: 5 } })) as NonNullable<Progress>;
        setProgress(current);
      }
      setMessage("Reconstruction terminée. Les articles à revoir sont marqués dans l'inventaire.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reconstruction impossible.");
    } finally {
      setBusy("");
    }
  };

  const resume = async () => {
    if (!progress?.id) return;
    setBusy("rebuild");
    try {
      let current = progress;
      while (current && !current.done && current.processed < current.total) {
        current = (await rebuildChunk({ data: { jobId: progress.id, size: 5 } })) as NonNullable<Progress>;
        setProgress(current);
      }
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-brand/25 bg-brand-soft/30 p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Contrôle du catalogue</p>
            <p className="text-xs text-foreground/60">
              Vérifie les articles enregistrés et, en mode approfondi, rouvre chaque page officielle du
              fabricant. Aucune valeur n'est devinée : les cas douteux restent à revoir.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground/70">
            <input type="checkbox" checked={deep} onChange={(event) => setDeep(event.target.checked)} />
            Comparer avec les pages officielles
          </label>
          <button
            type="button"
            onClick={doAudit}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === "audit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Lancer le contrôle
          </button>
          {audit ? (
            <button
              type="button"
              onClick={doRepair}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-full border border-brand/40 px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
            >
              {busy === "repair" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Appliquer les réparations sûres
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm">{message}</p> : null}

      {audit ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Articles contrôlés", value: audit.summary.checked },
              { label: "Conformes", value: audit.summary.verified },
              { label: "À revoir", value: audit.summary.needs_review },
              { label: "Incorrects", value: audit.summary.incorrect },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border p-4">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-foreground/60">{item.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-foreground/60">
            Pages officielles réellement rouvertes : {audit.deep_checked}
          </p>
          <div className="space-y-2">
            {audit.findings.map((finding, index) => (
              <div key={finding.id ?? index} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{finding.product_label}</span>
                  {finding.model ? (
                    <span className="text-xs text-foreground/50">{finding.model}</span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      severityStyle[finding.severity] ?? severityStyle["low"],
                    )}
                  >
                    {finding.severity}
                  </span>
                  {finding.auto_repair_safe ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                      réparation sûre
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm">{finding.problem}</p>
                {finding.evidence ? (
                  <p className="mt-1 text-xs text-foreground/60">Preuve : {finding.evidence}</p>
                ) : null}
                <p className="mt-1 text-xs text-foreground/60">Action : {finding.action}</p>
                {finding.source_url ? (
                  <a
                    href={finding.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-brand underline"
                  >
                    Page officielle
                  </a>
                ) : null}
              </div>
            ))}
            {audit.findings.length === 0 ? (
              <p className="rounded-2xl border border-border p-4 text-sm">
                Aucun problème détecté sur les {audit.summary.checked} articles contrôlés.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border p-5">
        <p className="text-sm font-semibold">Liste maîtresse & reconstruction</p>
        <p className="mt-1 text-xs text-foreground/60">
          {references} référence(s) conservée(s) définitivement (marque, modèle, page officielle). Elles
          survivent à la suppression des articles.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={doFreeze}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 rounded-full border border-brand/40 px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
          >
            {busy === "freeze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Mettre à jour la liste maîtresse
          </button>
          {isSuper ? (
            <button
              type="button"
              onClick={doRebuild}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {busy === "rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refaire tous les articles
            </button>
          ) : null}
          {progress && !progress.done && progress.processed < progress.total ? (
            <button
              type="button"
              onClick={resume}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Reprendre la reconstruction
            </button>
          ) : null}
        </div>
        {progress ? (
          <div className="mt-4 space-y-1 text-xs text-foreground/70">
            <p>
              Références conservées : {progress.references_preserved} · Articles supprimés :{" "}
              {progress.products_deleted}
            </p>
            <p>
              Refaits : {progress.processed}/{progress.total} · conformes {progress.verified} · à revoir{" "}
              {progress.needs_review} · échecs {progress.failed}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand transition-all"
                style={{
                  width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
