import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import {
  adminCreateStaff,
  adminCreateNode,
  adminDeleteNode,
  adminDeleteProduct,
  adminDeleteStaff,
  adminGetData,
  adminListStaff,
  adminLogin,
  adminLogout,
  adminMoveNode,
  adminNodeImpact,
  adminRenameNode,
  adminSaveProduct,
  adminQuickCreate,
  adminSaveSettings,
  adminStatus,
  adminUpdateStaffPassword,
} from "@/lib/admin.functions";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { ProductDraft } from "@/components/admin/ProductForm";
import type { SiteData, SiteSettings } from "@/lib/catalog-types";
import type { AdminRole, StaffAccount } from "@/lib/admin-types";

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
  const createNode = useServerFn(adminCreateNode);
  const renameNode = useServerFn(adminRenameNode);
  const moveNode = useServerFn(adminMoveNode);
  const nodeImpact = useServerFn(adminNodeImpact);
  const deleteNode = useServerFn(adminDeleteNode);
  const saveProduct = useServerFn(adminSaveProduct);
  const quickCreate = useServerFn(adminQuickCreate);
  const deleteProductFn = useServerFn(adminDeleteProduct);
  const saveSettings = useServerFn(adminSaveSettings);
  const listStaff = useServerFn(adminListStaff);
  const createStaff = useServerFn(adminCreateStaff);
  const updateStaffPassword = useServerFn(adminUpdateStaffPassword);
  const deleteStaff = useServerFn(adminDeleteStaff);

  const [phase, setPhase] = useState<"loading" | "locked" | "ready">("loading");
  const [data, setData] = useState<SiteData | null>(null);
  const [identity, setIdentity] = useState<{ username: string; role: AdminRole } | null>(null);
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
      const result = await status().catch(() => null);
      if (result?.authenticated && result.username) {
        setIdentity({ username: result.username, role: (result.role ?? "staff") as AdminRole });
        await refresh();
      } else setPhase("locked");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        setData(null);
        setIdentity(null);
        setPhase("locked");
      } else {
        console.error(err);
      }
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

  if (phase === "locked" || !data || !identity) {
    return (
      <AdminLogin
        onSubmit={async (username, password) => {
          const { ok, role, username: name } = await login({ data: { username, password } });
          if (ok && name) {
            setIdentity({ username: name, role: (role ?? "staff") as AdminRole });
            await refresh();
          }
          return ok;
        }}
      />
    );
  }

  return (
    <AdminDashboard
      data={data}
      busy={busy}
      role={identity.role}
      username={identity.username}
      staffActions={{
        list: async () => (await listStaff()) as StaffAccount[],
        create: async (name, password) => {
          await createStaff({ data: { username: name, password } });
        },
        resetPassword: async (id, password) => {
          await updateStaffPassword({ data: { id, password } });
        },
        remove: async (id) => {
          await deleteStaff({ data: { id } });
        },
      }}
      onLogout={async () => {
        await logout();
        setData(null);
        setIdentity(null);
        setPhase("locked");
      }}
      catalogActions={{
        createNode: (parentId, name) => run(() => createNode({ data: { parentId, name } })),
        renameNode: (id, name) => run(() => renameNode({ data: { id, name } })),
        moveNode: (id, direction) => run(() => moveNode({ data: { id, direction } })),
        deleteNode: (id) => run(() => deleteNode({ data: { id } })),
        nodeImpact: async (id) => await nodeImpact({ data: { id } }),
        quickCreate: (fromId, folders, draft: ProductDraft) =>
          run(() =>
            quickCreate({
              data: {
                fromId,
                folders,
                product: {
                  name: draft.name,
                  brand: draft.brand,
                  serial_number: draft.serial_number,
                  stock: draft.stock,
                  price: draft.price === "" ? null : Number(draft.price),
                  description: draft.description,
                  imageData: draft.imageData ?? null,
                  imageName: draft.imageName ?? null,
                  imageUrl: draft.imageUrl ?? null,
                  removeImage: false,
                },
              },
            }),
          ),
        deleteProduct: (id) => run(() => deleteProductFn({ data: { id } })),
        saveProduct: (draft: ProductDraft & { node_id: string }) =>
          run(() =>
            saveProduct({
              data: {
                ...(draft.id ? { id: draft.id } : {}),
                node_id: draft.node_id,
                name: draft.name,
                brand: draft.brand,
                serial_number: draft.serial_number,
                stock: draft.stock,
                price: draft.price === "" ? null : Number(draft.price),
                description: draft.description,
                imageData: draft.imageData ?? null,
                imageName: draft.imageName ?? null,
                imageUrl: draft.imageUrl ?? null,
                removeImage: Boolean(draft.removeImage),
              },
            }),
          ),
      }}
      onSaveSettings={(settings: SiteSettings) => run(() => saveSettings({ data: settings }))}
    />
  );
}