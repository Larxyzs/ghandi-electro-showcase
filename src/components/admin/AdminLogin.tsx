import { useState } from "react";
import { Lock, Loader2, User } from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";

export function AdminLogin({
  onSubmit,
}: {
  onSubmit: (username: string, password: string) => Promise<boolean>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const input =
    "w-full rounded-full border border-border bg-background py-3 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft/50 px-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          const ok = await onSubmit(username, password).catch(() => false);
          setBusy(false);
          if (!ok) {
            setError(true);
            setPassword("");
          }
        }}
        className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-9 shadow-[var(--shadow-card)]"
      >
        <img src={logo.url} alt="" className="mx-auto h-16 w-16 object-contain" />
        <h1 className="mt-6 text-center text-xl font-bold">Espace administrateur</h1>
        <p className="mt-2 text-center text-sm text-foreground/60">
          Entrez votre identifiant et votre mot de passe.
        </p>
        <div className="relative mt-7">
          <User className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Identifiant"
            aria-label="Identifiant"
            className={input}
          />
        </div>
        <div className="relative mt-3">
          <Lock className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            className={input}
          />
        </div>
        {error && (
          <p className="mt-3 text-center text-sm text-destructive">
            Identifiant ou mot de passe incorrect.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || password.length === 0 || username.trim().length === 0}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Se connecter
        </button>
      </form>
    </div>
  );
}
