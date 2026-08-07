import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminDeleteProduct,
  adminGetData,
  adminLogin,
  adminLogout,
  adminRenameCategory,
  adminSaveProduct,
  adminSaveSettings,
  adminStatus,
} from "@/lib/admin.functions";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { ProductDraft } from "@/components/admin/ProductForm";
import type { SiteData, SiteSettings } from "@/lib/catalog-types";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administration | Ghandi Home Electro" },
      { name: "description", content: "Espace d'administration du catalogue Ghandi Home Electro." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Administration | Ghandi Home Electro" },
      { property: "og:description", content: "Espace privé de gestion du catalogue." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(adminStatus);
  const login = useServerFn(adminLogin);
  const logout = useServerFn(adminLogout);
  const getData = useServerFn(adminGetData);
  const createCategory = useServerFn(adminCreateCategory);
  const renameCategory = useServerFn(adminRenameCategory);
  const deleteCategory = useServerFn(adminDeleteCategory);
  const saveProduct = useServerFn(adminSaveProduct);
  const deleteProductFn = useServerFn(adminDeleteProduct);
  const saveSettings = useServerFn(adminSaveSettings);

  const [phase, setPhase] = useState<"loading" | "locked" | "ready">("loading");
  const [data, setData] = useState<SiteData | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const fresh = (await getData()) as SiteData;
      setData(fresh);
      setPhase("ready");
    } catch {
      setPhase("locked");
    } finally {
      setBusy(false);
    }
  }, [getData]);

  useEffect(() => {
    (async () => {
      const result = await status().catch(() => ({ authenticated: false }));
      if (result.authenticated) await refresh();
      else setPhase("locked");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (phase === "locked" || !data) {
    return (
      <AdminLogin
        onSubmit={async (password) => {
          const { ok } = await login({ data: { password } });
          if (ok) await refresh();
          return ok;
        }}
      />
    );
  }

  return (
    <AdminDashboard
      data={data}
      busy={busy}
      onLogout={async () => {
        await logout();
        setData(null);
        setPhase("locked");
      }}
      onCreateCategory={(name) => run(() => createCategory({ data: { name } }))}
      onRenameCategory={(id, name) => run(() => renameCategory({ data: { id, name } }))}
      onDeleteCategory={(id) => run(() => deleteCategory({ data: { id } }))}
      onDeleteProduct={(id) => run(() => deleteProductFn({ data: { id } }))}
      onSaveProduct={(draft: ProductDraft & { category_id: string }) =>
        run(() =>
          saveProduct({
            data: {
              ...(draft.id ? { id: draft.id } : {}),
              category_id: draft.category_id,
              name: draft.name,
              serial_number: draft.serial_number,
              stock: draft.stock,
              price: draft.price === "" ? null : Number(draft.price),
              description: draft.description,
              imageData: draft.imageData ?? null,
              imageName: draft.imageName ?? null,
              removeImage: Boolean(draft.removeImage),
            },
          }),
        )
      }
      onSaveSettings={(settings: SiteSettings) => run(() => saveSettings({ data: settings }))}
    />
  );
}