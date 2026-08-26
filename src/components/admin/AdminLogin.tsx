import { useState } from "react";
import { Lock, Loader2, User } from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { lovable } from "@/integrations/lovable";

export function AdminLogin({
  onSubmit,
  googleError,
}: {
  onSubmit: (username: string, password: string) => Promise<boolean>;
  googleError?: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const input =
    "w-full rounded-full border border-border bg-background py-3 ps-11 pe-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-soft/50 px-5 py-10">

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

        <div className="my-6 flex items-center gap-3 text-xs text-foreground/45">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          disabled={googleBusy}
          onClick={async () => {
            setGoogleBusy(true);
            try {
              await lovable.auth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + "/admin",
              });
            } finally {
              setGoogleBusy(false);
            }
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-background py-3 text-sm font-semibold hover:border-brand hover:text-brand disabled:opacity-50"
        >
          {googleBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.29-2.66l-3.57-2.76c-.99.66-2.26 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
              />
            </svg>
          )}
          Continuer avec Google
        </button>

        {googleError && (
          <p className="mt-4 text-center text-sm text-destructive">{googleError}</p>
        )}
      </form>

    </div>
  );
}
