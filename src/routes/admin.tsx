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
  adminReparentNode,
  adminMoveProductToNode,
  adminNodeImpact,
  adminRenameNode,
  adminSaveProduct,
  adminQuickCreate,
  adminSaveSettings,
  adminStatus,
  adminAddPopularSearch,
  adminDeletePopularSearch,
  adminMovePopularSearch,
  adminUpdateStaffPassword,
  adminListCindySessions,
  adminSaveCindySession,
  adminDeleteCindySession,
  adminListActions,
  adminListResearchMemory,
  adminForgetResearchMemory,
  adminUndoAction,
  adminRecordAction,
  adminSetSiteMode,
  adminGoogleLogin,
  adminListEmails,
  adminAddEmail,
  adminDeleteEmail,
  adminGetSearchSettings,
  adminSaveSearchSettings,
  adminListImages,
  adminReplaceImage,
  adminListSnapshots,
  adminCreateSnapshot,
  adminRestoreSnapshot,
  adminSaveProductsBatch,
} from "@/lib/admin.functions";
import { adminListOrders, adminSetOrderStatus, adminDeleteOrder } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { FolderDraft, ProductDraft } from "@/components/admin/ProductForm";
import type { SiteData, SiteSettings } from "@/lib/catalog-types";
import type { AdminRole, StaffAccount } from "@/lib/admin-types";
import type { Order } from "@/lib/orders-types";


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
  const reparentNode = useServerFn(adminReparentNode);
  const moveProductToNode = useServerFn(adminMoveProductToNode);
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
  const addSearch = useServerFn(adminAddPopularSearch);
  const removeSearch = useServerFn(adminDeletePopularSearch);
  const moveSearch = useServerFn(adminMovePopularSearch);
  const listCindySessions = useServerFn(adminListCindySessions);
  const saveCindySession = useServerFn(adminSaveCindySession);
  const deleteCindySession = useServerFn(adminDeleteCindySession);
  const listActionsFn = useServerFn(adminListActions);
  const listResearchMemoryFn = useServerFn(adminListResearchMemory);
  const forgetResearchMemoryFn = useServerFn(adminForgetResearchMemory);
  const undoActionFn = useServerFn(adminUndoAction);
  const recordActionFn = useServerFn(adminRecordAction);
  const setSiteModeFn = useServerFn(adminSetSiteMode);
  const googleLogin = useServerFn(adminGoogleLogin);
  const listEmails = useServerFn(adminListEmails);
  const addEmail = useServerFn(adminAddEmail);
  const deleteEmail = useServerFn(adminDeleteEmail);
  const getSearchSettings = useServerFn(adminGetSearchSettings);
  const saveSearchSettings = useServerFn(adminSaveSearchSettings);
  const listSnapshots = useServerFn(adminListSnapshots);
  const createSnapshot = useServerFn(adminCreateSnapshot);
  const restoreSnapshot = useServerFn(adminRestoreSnapshot);
  const saveProductsBatch = useServerFn(adminSaveProductsBatch);
  const listImages = useServerFn(adminListImages);
  const replaceImageFn = useServerFn(adminReplaceImage);
  const listOrders = useServerFn(adminListOrders);
  const setOrderStatus = useServerFn(adminSetOrderStatus);
  const deleteOrder = useServerFn(adminDeleteOrder);

  const [phase, setPhase] = useState<"loading" | "locked" | "ready">("loading");
  const [data, setData] = useState<SiteData | null>(null);
  const [identity, setIdentity] = useState<{ username: string; role: AdminRole } | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

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
        return;
      }
      // Returning from a Google sign-in: exchange the session for an admin cookie.
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (token) {
        const outcome = await googleLogin({ data: { accessToken: token } }).catch(() => null);
        if (outcome?.ok) {
          setIdentity({ username: outcome.email, role: outcome.role as AdminRole });
          await refresh();
          return;
        }
        await supabase.auth.signOut().catch(() => undefined);
        setGoogleError(
          outcome?.reason === "NOT_AUTHORIZED"
            ? `Le compte ${outcome.email} n'est pas autorisé à accéder à l'administration.`
            : "Connexion Google impossible.",
        );
      }
      setPhase("locked");
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
        googleError={googleError}
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
      orderActions={{
        list: async () => (await listOrders()) as Order[],
        setStatus: (id, status) => setOrderStatus({ data: { id, status } }),
        remove: (id) => deleteOrder({ data: { id } }),
      }}
      imageActions={{
        list: async () => await listImages(),
        replace: async (item, dataUrl, name) => {
          await replaceImageFn({
            data: { kind: item.kind, id: item.id, imageData: dataUrl, imageName: name },
          });
        },
      }}
      apiActions={{
        load: async () => await getSearchSettings(),
        save: async (input) =>
          await saveSearchSettings({
            data: {
              provider: input.provider,
              key: input.key,
              model: input.model,
              aiProvider: input.aiProvider,
              aiModel: input.aiModel,
              aiKey: input.aiKey,
              test: input.test,
            },
          }),
      }}
      emailActions={{
        list: async () => await listEmails(),
        add: async (email, role) => {
          await addEmail({ data: { email, role } });
        },
        remove: async (id) => {
          await deleteEmail({ data: { id } });
        },
      }}
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
      searchActions={{
        add: (term) => run(() => addSearch({ data: { term } })),
        remove: (id) => run(() => removeSearch({ data: { id } })),
        move: (id, direction) => run(() => moveSearch({ data: { id, direction } })),
      }}
      onLogout={async () => {
        await logout();
        setData(null);
        setIdentity(null);
        setPhase("locked");
      }}
      catalogActions={{
        createNode: (parentId, name, image) =>
          run(() => createNode({ data: { parentId, name, image } })),
        renameNode: (id, name, image) => run(() => renameNode({ data: { id, name, image } })),
        moveNode: (id, direction) => run(() => moveNode({ data: { id, direction } })),
        reparentNode: (id, parentId) => run(() => reparentNode({ data: { id, parentId } })),
        moveProductToNode: (id, nodeId) => run(() => moveProductToNode({ data: { id, nodeId } })),
        deleteNode: (id) => run(() => deleteNode({ data: { id } })),
        nodeImpact: async (id) => await nodeImpact({ data: { id } }),
        quickCreate: (fromId, folders: FolderDraft[], draft: ProductDraft) =>
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
                  characteristics: draft.characteristics,
                  featured: draft.featured,
                  imageData: draft.imageData ?? null,
                  imageName: draft.imageName ?? null,
                  imageUrl: draft.imageUrl ?? null,
                  removeImage: false,
                },
              },
            }),
          ),
        deleteProduct: (id) => run(() => deleteProductFn({ data: { id } })),
        saveProductsBatch: (products) => run(() => saveProductsBatch({ data: { products } })),
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
                characteristics: draft.characteristics,
                featured: draft.featured,
                imageData: draft.imageData ?? null,
                imageName: draft.imageName ?? null,
                imageUrl: draft.imageUrl ?? null,
                removeImage: Boolean(draft.removeImage),
              },
            }),
          ),
      }}
      cindyActions={{
        listSessions: async () =>
          (await listCindySessions()).map((s) => ({
            id: s.id,
            title: s.title,
            query: s.query,
            events: s.events as unknown[],
            updated_at: s.updated_at,
          })),
        saveSession: async (input) =>
          await saveCindySession({
            data: {
              id: input.id ?? null,
              title: input.title,
              query: input.query,
              events: input.events,
            },
          }),
        deleteSession: async (id) => {
          await deleteCindySession({ data: { id } });
        },
        listActions: async () =>
          (await listActionsFn()).map((a) => ({
            id: a.id,
            action: a.action,
            label: a.label,
            undone_at: a.undone_at,
            created_at: a.created_at,
          })),
        undoAction: (id) => run(() => undoActionFn({ data: { id } })),
        listMemory: async () =>
          (await listResearchMemoryFn()).map((m) => ({
            id: m.id,
            query: m.query,
            brand: m.brand,
            model: m.model,
            hits: m.hits,
            searches_used: m.searches_used,
            updated_at: m.updated_at,
          })),
        listSnapshots: async () => await listSnapshots(),
        createSnapshot: async (label: string) => {
          await createSnapshot({ data: { label } });
        },
        restoreSnapshot: async (id: string) => {
          await restoreSnapshot({ data: { id } });
        },
        refreshSite: () => refresh(),
        forgetMemory: async (id) => {
          await forgetResearchMemoryFn({ data: { id } });
        },
        importProduct: async (payload) => {
          await run(async () => {
            const saved = await saveProduct({
              data: {
                node_id: payload.node_id,
                name: payload.name,
                brand: payload.brand,
                serial_number: payload.serial_number,
                stock: payload.stock,
                price: payload.price,
                characteristics: payload.characteristics,
                specifications: payload.specifications,
                gallery: payload.gallery,
                marketing_sections: payload.marketing_sections as never,
                source_url: payload.source_url,
                source_name: payload.source_name,
                featured: false,
                imageUrl: payload.imageUrl,
                imageData: null,
                imageName: null,
                removeImage: false,
              },
            });
            await recordActionFn({
              data: {
                action: "product_create",
                entity: "product",
                entity_id: (saved as { id?: string })?.id ?? null,
                label: `Produit créé par Cindy : ${payload.name}`,
                after_state: { name: payload.name },
              },
            });
          });
        },
      }}
      onSetSiteMode={async (mode) => {
        await run(async () => {
          const res = await setSiteModeFn({ data: { mode } });
          await recordActionFn({
            data: {
              action: "site_mode",
              entity: "site_settings",
              label: `Mode du site : ${mode}`,
              before_state: { site_mode: res.previous },
              after_state: { site_mode: mode },
            },
          });
        });
      }}
      onSaveSettings={(settings: SiteSettings) => run(() => saveSettings({ data: settings }))}
    />
  );
}