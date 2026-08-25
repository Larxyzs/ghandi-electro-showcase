import { useEffect, useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import type { AdminRole } from "@/lib/admin-types";

export type AdminEmail = { id: string; email: string; role: AdminRole };

/** Google emails allowed to open the admin panel. */
export function AdminEmailsPanel({
  load,
  add,
  remove,
}: {
  load: () => Promise<AdminEmail[]>;
  add: (email: string, role: AdminRole) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<AdminEmail[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => setRows(await load().catch(() => []));

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await add(email.trim().toLowerCase(), role);
            setEmail("");
            await refresh();
          } catch (err) {
            const message = err instanceof Error ? err.message : "";
            setError(
              message.includes("EMAIL_TAKEN")
                ? "Cet e-mail est déjà autorisé."
                : message.includes("INVALID_EMAIL")
                  ? "Adresse e-mail invalide."
                  : "Opération impossible.",
            );
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-3xl border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold">Connexion Google autorisée</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Seules ces adresses Google peuvent ouvrir l'espace administrateur.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Mail className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@gmail.com"
              inputMode="email"
              className="w-full rounded-xl border border-border bg-background py-2.5 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value === "super" ? "super" : "staff")}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          >
            <option value="staff">Administrateur</option>
            <option value="super">Super admin</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-brand)" }}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Autoriser
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </form>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Adresses autorisées</h2>
        {rows === null ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-foreground/60">
            Aucune adresse. La première connexion Google deviendra automatiquement super admin.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-2xl border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.email}</p>
                  <p className="text-xs text-foreground/55">
                    {row.role === "super" ? "Super admin" : "Administrateur"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Retirer ${row.email} ?`)) return;
                    await remove(row.id);
                    await refresh();
                  }}
                  aria-label="Retirer l'accès"
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
