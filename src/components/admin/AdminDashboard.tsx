import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  LogOut,
  Package,
  Palette,
  ExternalLink,
  Users,
} from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import type { SiteData, SiteSettings } from "@/lib/catalog-types";
import { CatalogExplorer, type CatalogActions } from "@/components/admin/CatalogExplorer";
import { StaffPanel } from "@/components/admin/StaffPanel";
import type { AdminRole, StaffAccount } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

export function AdminDashboard({
  data,
  busy,
  role,
  username,
  staffActions,
  catalogActions,
  onLogout,
  onSaveSettings,
}: {
  data: SiteData;
  busy: boolean;
  role: AdminRole;
  username: string;
  staffActions: {
    list: () => Promise<StaffAccount[]>;
    create: (username: string, password: string) => Promise<void>;
    resetPassword: (id: string, password: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  catalogActions: CatalogActions;
  onLogout: () => void;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
}) {
  const [tab, setTab] = useState<"inventory" | "design" | "staff">("inventory");
  const [settings, setSettings] = useState<SiteSettings>(data.settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(data.settings);
  }, [data.settings]);

  return (
    <div className="min-h-screen bg-brand-soft/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-18 w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold">Administration</p>
              <p className="text-xs text-foreground/55">
                {username}
                {role === "super" ? " · Super admin" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand sm:flex"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Voir le site
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> Quitter
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-5xl gap-2 px-5 pb-3">
          {(
            [
              { id: "inventory", label: "Inventaire", icon: Package },
              { id: "design", label: "Apparence", icon: Palette },
              ...(role === "super"
                ? ([{ id: "staff", label: "Gestion des admins", icon: Users }] as const)
                : []),
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                tab === item.id
                  ? "bg-brand text-primary-foreground"
                  : "text-foreground/60 hover:bg-brand-soft hover:text-brand",
              )}
            >
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        {tab === "staff" && role === "super" ? (
          <StaffPanel
            load={staffActions.list}
            onCreate={staffActions.create}
            onResetPassword={staffActions.resetPassword}
            onDelete={staffActions.remove}
          />
        ) : tab === "inventory" ? (
          <CatalogExplorer data={data} busy={busy} actions={catalogActions} />
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSaveSettings(settings);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2500);
            }}
            className="max-w-xl rounded-3xl border border-border bg-card p-7"
          >
            <h2 className="text-lg font-semibold">Couleurs du site</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Les modifications s'appliquent immédiatement à tout le site.
            </p>
            <div className="mt-6 space-y-5">
              {(
                [
                  { key: "primary_color", label: "Couleur principale (fond)" },
                  { key: "secondary_color", label: "Couleur secondaire (accent)" },
                  { key: "text_color", label: "Couleur du texte" },
                ] as const
              ).map((item) => (
                <div key={item.key} className="flex items-center gap-4">
                  <input
                    type="color"
                    value={settings[item.key]}
                    onChange={(e) => setSettings((s) => ({ ...s, [item.key]: e.target.value }))}
                    className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-background"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <input
                      value={settings[item.key]}
                      onChange={(e) => setSettings((s) => ({ ...s, [item.key]: e.target.value }))}
                      className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-xs uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex items-center gap-4">
              <button
                type="submit"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    primary_color: "#ffffff",
                    secondary_color: "#1266e8",
                    text_color: "#0f172a",
                  })
                }
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
              >
                Réinitialiser
              </button>
              {saved && <span className="text-sm font-semibold text-brand">Enregistré ✓</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}