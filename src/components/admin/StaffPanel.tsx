import { useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, KeyRound } from "lucide-react";
import type { StaffAccount } from "@/lib/admin-types";

export function StaffPanel({
  load,
  onCreate,
  onResetPassword,
  onDelete,
}: {
  load: () => Promise<StaffAccount[]>;
  onCreate: (username: string, password: string) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [staff, setStaff] = useState<StaffAccount[] | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    setStaff(await load().catch(() => []));
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = (err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("USERNAME_TAKEN")) return "Cet identifiant existe déjà.";
    if (message.includes("INVALID_USERNAME"))
      return "Identifiant invalide (3 à 32 caractères : lettres, chiffres, . _ -).";
    if (message.includes("WEAK_PASSWORD")) return "Mot de passe trop court (6 caractères minimum).";
    return "Opération impossible.";
  };

  const field =
    "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setNotice(null);
          try {
            await onCreate(username.trim().toLowerCase(), password);
            setUsername("");
            setPassword("");
            setNotice("Compte créé.");
            await refresh();
          } catch (err) {
            setError(label(err));
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-3xl border border-border bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Créer un compte administrateur</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Ces comptes peuvent gérer les catégories, articles et stocks, mais pas cet onglet.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Identifiant
            <input
              className={`mt-1.5 ${field}`}
              value={username}
              autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. amine.vendeur"
            />
          </label>
          <label className="text-sm font-medium">
            Mot de passe
            <input
              type="text"
              className={`mt-1.5 ${field}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
            />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {notice && <p className="mt-4 text-sm text-brand">{notice}</p>}
        <button
          type="submit"
          disabled={busy || !username.trim() || password.length < 6}
          className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Créer le compte
        </button>
      </form>

      <div className="rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Comptes existants</h2>
        {staff === null ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" />
          </div>
        ) : staff.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/60">Aucun compte pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {staff.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{account.username}</p>
                  <p className="text-xs text-foreground/55">Administrateur</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const next = window.prompt(`Nouveau mot de passe pour ${account.username} :`);
                    if (!next) return;
                    try {
                      await onResetPassword(account.id, next);
                      setNotice("Mot de passe mis à jour.");
                      setError(null);
                    } catch (err) {
                      setError(label(err));
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:border-brand hover:text-brand"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Mot de passe
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Supprimer le compte « ${account.username} » ?`)) return;
                    await onDelete(account.id);
                    await refresh();
                  }}
                  aria-label="Supprimer le compte"
                  className="rounded-full p-2 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
