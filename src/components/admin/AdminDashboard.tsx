import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  LogOut,
  Package,
  Palette,
  ExternalLink,
  Search,
  Sparkles,
  Users,
  ShoppingBag,
  ImageIcon,
  KeyRound,
  Mail,
} from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import type { SiteData, SiteSettings } from "@/lib/catalog-types";
import { CatalogExplorer, type CatalogActions } from "@/components/admin/CatalogExplorer";
import { StaffPanel } from "@/components/admin/StaffPanel";
import { PopularSearchesPanel } from "@/components/admin/PopularSearchesPanel";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { ImageOptimizerPanel } from "@/components/admin/ImageOptimizerPanel";
import {
  SearchApiPanel,
  type SearchSaveInput,
  type SearchSaveResult,
  type SearchSettings,
} from "@/components/admin/SearchApiPanel";
import { AdminEmailsPanel, type AdminEmail } from "@/components/admin/AdminEmailsPanel";
import { CindyWorkspace, type CindyActions } from "@/components/admin/cindy/CindyWorkspace";
import { SITE_MODE_LABELS, type SiteMode } from "@/lib/catalog-types";
import type { AdminRole, StaffAccount } from "@/lib/admin-types";
import type { Order, OrderStatus } from "@/lib/orders-types";
import { cn } from "@/lib/utils";

type ImageItem = { id: string; kind: "product" | "node"; label: string; imageUrl: string | null };

export function AdminDashboard({
  data,
  busy,
  role,
  username,
  staffActions,
  catalogActions,
  cindyActions,
  searchActions,
  orderActions,
  imageActions,
  apiActions,
  emailActions,
  onSetSiteMode,
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
  cindyActions: CindyActions;
  onSetSiteMode: (mode: SiteMode) => Promise<void>;
  searchActions: {
    add: (term: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    move: (id: string, direction: "up" | "down") => Promise<void>;
  };
  orderActions: {
    list: () => Promise<Order[]>;
    setStatus: (id: string, status: OrderStatus) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  };
  imageActions: {
    list: () => Promise<ImageItem[]>;
    replace: (
      item: { id: string; kind: "product" | "node" },
      dataUrl: string,
      name: string,
    ) => Promise<void>;
  };
  apiActions: {
    load: () => Promise<SearchSettings>;
    save: (input: SearchSaveInput) => Promise<SearchSaveResult>;
  };
  emailActions: {
    list: () => Promise<AdminEmail[]>;
    add: (email: string, role: AdminRole) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  onLogout: () => void;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
}) {
  const [tab, setTab] = useState<
    | "inventory"
    | "orders"
    | "cindy"
    | "checkup"
    | "design"
    | "searches"
    | "images"
    | "api"
    | "emails"
    | "staff"
  >("inventory");
  const { t } = useI18n();
  const [settings, setSettings] = useState<SiteSettings>(data.settings);
  const [saved, setSaved] = useState(false);
  const [images, setImages] = useState<ImageItem[] | null>(null);

  useEffect(() => {
    setSettings(data.settings);
  }, [data.settings]);

  useEffect(() => {
    if (tab !== "images" || images !== null) return;
    void imageActions.list().then(setImages).catch(() => setImages([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);


  return (
    <div className="min-h-screen bg-brand-soft/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-18 w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold">{t("admin.title")}</p>
              <p className="text-xs text-foreground/55">
                {username}
                {role === "super" ? ` · ${t("admin.super")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
            <LanguageSwitcher />
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand sm:flex"
            >
              <ExternalLink className="h-3.5 w-3.5" /> {t("admin.viewSite")}
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" /> {t("admin.logout")}
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-5 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              { id: "inventory", label: t("admin.tab.inventory"), icon: Package },
              { id: "orders", label: t("admin.tab.orders"), icon: ShoppingBag },
              { id: "cindy", label: t("admin.tab.cindy"), icon: Sparkles },
              { id: "design", label: t("admin.tab.design"), icon: Palette },
              { id: "searches", label: t("admin.tab.searches"), icon: Search },
              { id: "images", label: t("admin.tab.images"), icon: ImageIcon },
              { id: "api", label: t("admin.tab.api"), icon: KeyRound },
              ...(role === "super"
                ? ([
                    { id: "emails", label: t("admin.tab.emails"), icon: Mail },
                    { id: "staff", label: t("admin.tab.staff"), icon: Users },
                  ] as const)
                : []),
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
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

      <main
        className={cn(
          "mx-auto w-full px-4 py-6 sm:px-5 sm:py-10",
          tab === "cindy" ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        {tab === "staff" && role === "super" ? (
          <StaffPanel
            load={staffActions.list}
            onCreate={staffActions.create}
            onResetPassword={staffActions.resetPassword}
            onDelete={staffActions.remove}
          />
        ) : tab === "emails" && role === "super" ? (
          <AdminEmailsPanel
            load={emailActions.list}
            add={emailActions.add}
            remove={emailActions.remove}
          />
        ) : tab === "api" ? (
          <SearchApiPanel load={apiActions.load} save={apiActions.save} />
        ) : tab === "orders" ? (
          <OrdersPanel
            list={orderActions.list}
            setStatus={orderActions.setStatus}
            remove={orderActions.remove}
          />
        ) : tab === "images" ? (
          images === null ? (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
            </div>
          ) : (
            <ImageOptimizerPanel items={images} onOptimized={imageActions.replace} />
          )
        ) : tab === "searches" ? (
          <PopularSearchesPanel terms={data.popularSearches} actions={searchActions} />
        ) : tab === "cindy" ? (
          <CindyWorkspace data={data} actions={cindyActions} />

        ) : tab === "inventory" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brand/25 bg-brand-soft/30 p-5">
              <div className="flex items-start gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t("admin.cindy.title")}</p>
                  <p className="text-xs text-foreground/60">
                    {t("admin.cindy.desc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab("cindy")}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                {t("admin.cindy.cta")}
              </button>
            </div>
            <CatalogExplorer data={data} busy={busy} actions={catalogActions} />
          </div>
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
            <div className="mb-8 rounded-2xl border border-border bg-brand-soft/25 p-5">
              <h2 className="text-lg font-semibold">{t("admin.mode.title")}</h2>
              <p className="mt-1 text-sm text-foreground/60">
                {t("admin.mode.desc")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(SITE_MODE_LABELS) as SiteMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, site_mode: mode }));
                      void onSetSiteMode(mode);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition",
                      settings.site_mode === mode
                        ? "border-brand bg-brand text-primary-foreground"
                        : "border-border hover:border-brand hover:text-brand",
                    )}
                  >
                    {SITE_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            <h2 className="text-lg font-semibold">{t("admin.colors.title")}</h2>
            <p className="mt-1 text-sm text-foreground/60">
              {t("admin.colors.desc")}
            </p>
            <div className="mt-6 space-y-5">
              {(
                [
                  { key: "primary_color", label: t("admin.colors.primary") },
                  { key: "secondary_color", label: t("admin.colors.secondary") },
                  { key: "text_color", label: t("admin.colors.text") },
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
                {t("admin.save")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    primary_color: "#ffffff",
                    secondary_color: "#1266e8",
                    text_color: "#0f172a",
                  }))
                }
                className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
              >
                {t("admin.reset")}
              </button>
              {saved && <span className="text-sm font-semibold text-brand">{t("admin.saved")}</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}