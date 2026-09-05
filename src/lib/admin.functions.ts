import { createServerFn } from "@tanstack/react-start";

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await import("./admin.server");
  const me = await currentAdmin();
  return { authenticated: Boolean(me), username: me?.username ?? null, role: me?.role ?? null };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: String(data.username ?? "").slice(0, 64),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { login } = await import("./admin.server");
    const me = await login(data.username, data.password);
    return { ok: Boolean(me), role: me?.role ?? null, username: me?.username ?? null };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { lock } = await import("./admin.server");
  await lock();
  return { ok: true as const };
});

export const adminGetData = createServerFn({ method: "GET" }).handler(async () => {
  const { adminData } = await import("./admin.server");
  return adminData();
});

export const adminListStaff = createServerFn({ method: "GET" }).handler(async () => {
  const { listStaff } = await import("./admin.server");
  return listStaff();
});

export const adminCreateStaff = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: String(data.username ?? "").slice(0, 64),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { createStaff } = await import("./admin.server");
    return createStaff(data.username, data.password);
  });

export const adminUpdateStaffPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; password: string }) => ({
    id: String(data.id),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { updateStaffPassword } = await import("./admin.server");
    return updateStaffPassword(data.id, data.password);
  });

export const adminDeleteStaff = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteStaff } = await import("./admin.server");
    return deleteStaff(data.id);
  });

export type AdminImageInput = {
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

export const adminCreateNode = createServerFn({ method: "POST" })
  .inputValidator((data: { parentId: string | null; name: string; image?: AdminImageInput }) => ({
    parentId: data.parentId ? String(data.parentId) : null,
    name: String(data.name ?? "").slice(0, 80),
    image: data.image ?? undefined,
  }))
  .handler(async ({ data }) => {
    const { createNode } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return createNode(data.parentId, data.name, data.image);
  });

export const adminRenameNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string; image?: AdminImageInput }) => ({
    id: String(data.id),
    name: String(data.name ?? "").slice(0, 80),
    image: data.image ?? undefined,
  }))
  .handler(async ({ data }) => {
    const { renameNode } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return renameNode(data.id, data.name, data.image);
  });

export const adminMoveNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direction: "up" | "down" }) => ({
    id: String(data.id),
    direction: data.direction === "up" ? ("up" as const) : ("down" as const),
  }))
  .handler(async ({ data }) => {
    const { moveNode } = await import("./admin.server");
    return moveNode(data.id, data.direction);
  });

export const adminReparentNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; parentId: string | null }) => ({
    id: String(data.id),
    parentId: data.parentId ? String(data.parentId) : null,
  }))
  .handler(async ({ data }) => {
    const { reparentNode } = await import("./admin.server");
    return reparentNode(data.id, data.parentId);
  });

export const adminMoveProductToNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; nodeId: string }) => ({
    id: String(data.id),
    nodeId: String(data.nodeId),
  }))
  .handler(async ({ data }) => {
    const { moveProductToNode } = await import("./admin.server");
    return moveProductToNode(data.id, data.nodeId);
  });

export const adminLinkProductToNode = createServerFn({ method: "POST" })
  .inputValidator((data: { productId: string; nodeId: string }) => ({
    productId: String(data.productId),
    nodeId: String(data.nodeId),
  }))
  .handler(async ({ data }) => {
    const { linkProductToNode } = await import("./admin.server");
    return linkProductToNode(data.productId, data.nodeId);
  });

export const adminUnlinkProductFromNode = createServerFn({ method: "POST" })
  .inputValidator((data: { productId: string; nodeId: string }) => ({
    productId: String(data.productId),
    nodeId: String(data.nodeId),
  }))
  .handler(async ({ data }) => {
    const { unlinkProductFromNode } = await import("./admin.server");
    return unlinkProductFromNode(data.productId, data.nodeId);
  });

export const adminAttachProductBySerial = createServerFn({ method: "POST" })
  .inputValidator((data: { serial: string; nodeId: string }) => ({
    serial: String(data.serial),
    nodeId: String(data.nodeId),
  }))
  .handler(async ({ data }) => {
    const { attachProductBySerial } = await import("./admin.server");
    return attachProductBySerial(data.serial, data.nodeId);
  });

export const adminNodeImpact = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { nodeDeletionImpact } = await import("./admin.server");
    return nodeDeletionImpact(data.id);
  });

export const adminDeleteNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteNode } = await import("./admin.server");
    return deleteNode(data.id);
  });

export type AdminProductInput = {
  id?: string;
  node_id: string;
  node_ids?: string[];
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  characteristics: string;
  specifications?: { label: string; value: string }[];
  gallery?: (string | { imageData: string; imageName: string })[];
  marketing_sections?: import("@/integrations/supabase/types").Json[];
  source_url?: string | null;
  source_name?: string | null;
  featured?: boolean;
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

export const adminSaveProduct = createServerFn({ method: "POST" })
  .inputValidator((data: AdminProductInput) => data)
  .handler(async ({ data }) => {
    const { saveProduct } = await import("./admin.server");
    if (!data.name?.trim()) throw new Error("EMPTY_NAME");
    if (!data.node_id) throw new Error("NO_FOLDER");
    return saveProduct({
      ...data,
      ...(data.node_ids ? { node_ids: data.node_ids.map((id) => String(id)) } : {}),
      brand: data.brand ?? "",
      stock: Number.isFinite(data.stock) ? data.stock : 0,
      serial_number: data.serial_number ?? "",
      characteristics: data.characteristics ?? "",
      price: data.price ?? null,
    });
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteProduct } = await import("./admin.server");
    return deleteProduct(data.id);
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { primary_color: string; secondary_color: string; text_color: string }) => ({
    primary_color: String(data.primary_color),
    secondary_color: String(data.secondary_color),
    text_color: String(data.text_color),
  }))
  .handler(async ({ data }) => {
    const { saveSettings } = await import("./admin.server");
    return saveSettings(data);
  });

export const adminQuickCreate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      fromId: string | null;
      folders: {
        name: string;
        imageData?: string | null;
        imageName?: string | null;
        imageUrl?: string | null;
      }[];
      product: Omit<AdminProductInput, "id" | "node_id">;
    }) => ({
      fromId: data.fromId ? String(data.fromId) : null,
      folders: (data.folders ?? []).map((folder) => ({
        name: String(folder?.name ?? "").slice(0, 80),
        imageData: folder?.imageData ?? null,
        imageName: folder?.imageName ?? null,
        imageUrl: folder?.imageUrl ?? null,
      })),
      product: data.product,
    }),
  )

  .handler(async ({ data }) => {
    const { quickCreateChain } = await import("./admin.server");
    if (!data.product?.name?.trim()) throw new Error("EMPTY_NAME");
    return quickCreateChain({
      fromId: data.fromId,
      folders: data.folders,
      product: {
        ...data.product,
        brand: data.product.brand ?? "",
        stock: Number.isFinite(data.product.stock) ? data.product.stock : 0,
        serial_number: data.product.serial_number ?? "",
        characteristics: data.product.characteristics ?? "",
        price: data.product.price ?? null,
      },
    });
  });


export const adminSetFeatured = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; featured: boolean }) => ({
    id: String(data.id),
    featured: Boolean(data.featured),
  }))
  .handler(async ({ data }) => {
    const { setProductFeatured } = await import("./admin.server");
    return setProductFeatured(data.id, data.featured);
  });

export const adminAddPopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { term: string }) => ({ term: String(data.term ?? "").slice(0, 60) }))
  .handler(async ({ data }) => {
    const { addPopularSearch } = await import("./admin.server");
    return addPopularSearch(data.term);
  });

export const adminDeletePopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deletePopularSearch } = await import("./admin.server");
    return deletePopularSearch(data.id);
  });

export const adminMovePopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direction: "up" | "down" }) => ({
    id: String(data.id),
    direction: data.direction === "up" ? ("up" as const) : ("down" as const),
  }))
  .handler(async ({ data }) => {
    const { movePopularSearch } = await import("./admin.server");
    return movePopularSearch(data.id, data.direction);
  });


/* ---------- Site mode ---------- */

export const adminSetSiteMode = createServerFn({ method: "POST" })
  .inputValidator((data: { mode: string }) => ({ mode: String(data.mode) }))
  .handler(async ({ data }) => {
    const { setSiteMode } = await import("./admin.server");
    return setSiteMode(data.mode as "online" | "maintenance" | "coming_soon" | "closed");
  });

/* ---------- Cindy sessions & action history ---------- */

export const adminListCindySessions = createServerFn({ method: "POST" }).handler(async () => {
  const { listCindySessions } = await import("./admin.server");
  return listCindySessions();
});

export const adminSaveCindySession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id?: string | null; title: string; query: string; events: unknown[] }) => data,
  )
  .handler(async ({ data }) => {
    const { saveCindySession } = await import("./admin.server");
    return saveCindySession({
      id: data.id ?? null,
      title: data.title,
      query: data.query,
      events: data.events as never,
    });
  });

export const adminDeleteCindySession = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteCindySession } = await import("./admin.server");
    return deleteCindySession(data.id);
  });

export const adminListActions = createServerFn({ method: "POST" }).handler(async () => {
  const { listActions } = await import("./admin.server");
  return listActions();
});

export const adminUndoAction = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { undoAction } = await import("./admin.server");
    return undoAction(data.id);
  });

export const adminRecordAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      action: string;
      entity: string;
      entity_id?: string | null;
      label: string;
      before_state?: unknown;
      after_state?: unknown;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { recordAction } = await import("./admin.server");
    return recordAction({
      action: data.action,
      entity: data.entity,
      entity_id: data.entity_id ?? null,
      label: data.label,
      before_state: (data.before_state ?? null) as never,
      after_state: (data.after_state ?? null) as never,
    });
  });

export const adminListResearchMemory = createServerFn({ method: "POST" }).handler(async () => {
  const { listResearchMemory } = await import("./admin.server");
  return listResearchMemory();
});

export const adminForgetResearchMemory = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { forgetResearchMemory } = await import("./admin.server");
    return forgetResearchMemory(data.id);
  });


/* ---------- Google sign-in & authorized emails ---------- */

export const adminGoogleLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => ({
    accessToken: String(data.accessToken ?? "").slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const { loginWithGoogle } = await import("./admin.server");
    return loginWithGoogle(data.accessToken);
  });

export const adminListEmails = createServerFn({ method: "GET" }).handler(async () => {
  const { listAdminEmails } = await import("./admin.server");
  return listAdminEmails();
});

export const adminAddEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; role: "super" | "staff" }) => ({
    email: String(data.email ?? "").slice(0, 160),
    role: data.role === "super" ? ("super" as const) : ("staff" as const),
  }))
  .handler(async ({ data }) => {
    const { addAdminEmail } = await import("./admin.server");
    return addAdminEmail(data.email, data.role);
  });

export const adminDeleteEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteAdminEmail } = await import("./admin.server");
    return deleteAdminEmail(data.id);
  });

/* ---------- Cindy research API settings ---------- */

export const adminGetSearchSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getSearchSettings } = await import("./admin.server");
  return getSearchSettings();
});

export const adminSaveSearchSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      provider: string;
      key: string | null;
      model?: string;
      aiProvider?: string;
      aiModel?: string;
      aiKey?: string | null;
      test?: boolean;
    }) => ({
      provider: String(data.provider) as "tavily" | "serper" | "brave",
      key: data.key ? String(data.key).slice(0, 300) : null,
      model: String(data.model ?? "search"),
      aiProvider: String(data.aiProvider ?? "openai") as "openai" | "gemini" | "lovable",
      aiModel: String(data.aiModel ?? ""),
      aiKey: data.aiKey ? String(data.aiKey).slice(0, 300) : null,
      test: Boolean(data.test),
    }),
  )
  .handler(async ({ data }) => {
    const { saveSearchSettings } = await import("./admin.server");
    return saveSearchSettings(data);
  });

/* ---------- Image maintenance ---------- */

export const adminListImages = createServerFn({ method: "GET" }).handler(async () => {
  const { listAllImages } = await import("./admin.server");
  return listAllImages();
});

export const adminReplaceImage = createServerFn({ method: "POST" })
  .inputValidator((data: { kind: "product" | "node"; id: string; imageData: string; imageName: string }) => ({
    kind: data.kind === "node" ? ("node" as const) : ("product" as const),
    id: String(data.id),
    imageData: String(data.imageData ?? ""),
    imageName: String(data.imageName ?? "image.jpg"),
  }))
  .handler(async ({ data }) => {
    const { replaceImage } = await import("./admin.server");
    return replaceImage(data);
  });

/* ---------- Restore points ---------- */

export const adminListSnapshots = createServerFn({ method: "POST" }).handler(async () => {
  const { listSnapshots } = await import("./admin.server");
  return listSnapshots();
});

export const adminCreateSnapshot = createServerFn({ method: "POST" })
  .inputValidator((data: { label?: string }) => ({ label: String(data?.label ?? "").trim() }))
  .handler(async ({ data }) => {
    const { createSnapshot } = await import("./admin.server");
    return createSnapshot(data.label || "Point de restauration");
  });

export const adminRestoreSnapshot = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { restoreSnapshot } = await import("./admin.server");
    return restoreSnapshot(data.id);
  });

/* ---------- Batch product save ("Tout enregistrer") ---------- */

export const adminSaveProductsBatch = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      products: {
        id: string;
        name: string;
        brand: string;
        serial_number: string;
        stock: number;
        price: number | null;
        characteristics: string;
        featured: boolean;
      }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { saveProduct, adminDb } = await import("./admin.server");
    const db = await adminDb();
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const item of data.products) {
      try {
        const { data: existing } = await db
          .from("products")
          .select("node_id")
          .eq("id", item.id)
          .single();
        await saveProduct({
          id: item.id,
          node_id: existing!.node_id,
          name: item.name,
          brand: item.brand,
          serial_number: item.serial_number,
          stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
          price: item.price === null ? null : Number(item.price),
          characteristics: item.characteristics,
          featured: item.featured,
        });
        results.push({ id: item.id, ok: true });
      } catch (error) {
        results.push({
          id: item.id,
          ok: false,
          error: error instanceof Error ? error.message : "ERREUR",
        });
      }
    }
    return { saved: results.filter((r) => r.ok).length, results };
  });

/* ---------- Catalogue checkup & master reference rebuild ---------- */

export const adminFreezeReferences = createServerFn({ method: "POST" }).handler(async () => {
  const { currentAdmin } = await import("./admin.server");
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { freezeReferences } = await import("./catalog-references.server");
  return freezeReferences();
});

export const adminListReferences = createServerFn({ method: "POST" })
  .inputValidator((data: { limit?: number }) => ({ limit: Number(data?.limit ?? 300) }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
    const { listReferences } = await import("./catalog-references.server");
    return listReferences({ limit: Math.min(1000, Math.max(1, data.limit)) });
  });

export const adminRunCatalogAudit = createServerFn({ method: "POST" })
  .inputValidator((data: { deep?: boolean; deepLimit?: number }) => ({
    deep: data?.deep === true,
    deepLimit: Number(data?.deepLimit ?? 40),
  }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    const me = await currentAdmin();
    if (!me) throw new Error("UNAUTHORIZED");
    const { runCatalogAudit } = await import("./catalog-audit.server");
    const run = await runCatalogAudit({
      deep: data.deep,
      deepLimit: Math.min(300, Math.max(1, data.deepLimit)),
      createdBy: me.username,
      explain: false,
    });
    return {
      id: run.id,
      summary: run.summary,
      report: run.report,
      deep_checked: run.deep_checked,
      findings: run.findings.slice(0, 300),
    };
  });

export const adminListAuditRuns = createServerFn({ method: "POST" }).handler(async () => {
  const { currentAdmin } = await import("./admin.server");
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { listAuditRuns } = await import("./catalog-audit.server");
  return listAuditRuns();
});

export const adminListAuditFindings = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string }) => ({ runId: String(data.runId) }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
    const { listAuditFindings } = await import("./catalog-audit.server");
    return listAuditFindings(data.runId);
  });

export const adminRepairAudit = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string; ids?: string[]; limit?: number }) => ({
    runId: String(data.runId),
    ids: Array.isArray(data.ids) ? data.ids.map(String).slice(0, 300) : [],
    limit: Number(data?.limit ?? 50),
  }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
    const { repairAuditFindings } = await import("./catalog-audit.server");
    return repairAuditFindings(data.runId, {
      ...(data.ids.length ? { ids: data.ids } : {}),
      limit: Math.min(300, Math.max(1, data.limit)),
    });
  });

export const adminStartRebuild = createServerFn({ method: "POST" })
  .inputValidator((data: { deleteProducts?: boolean }) => ({
    deleteProducts: data?.deleteProducts !== false,
  }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    const me = await currentAdmin();
    if (!me || me.role !== "super") throw new Error("FORBIDDEN");
    const { startRebuild } = await import("./catalog-rebuild.server");
    return startRebuild({ deleteProducts: data.deleteProducts, createdBy: me.username });
  });

export const adminRebuildChunk = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId: string; size?: number }) => ({
    jobId: String(data.jobId),
    size: Number(data?.size ?? 10),
  }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
    const { runRebuildChunk } = await import("./catalog-rebuild.server");
    return runRebuildChunk(data.jobId, { size: Math.min(50, Math.max(1, data.size)) });
  });

export const adminRebuildState = createServerFn({ method: "POST" })
  .inputValidator((data: { jobId?: string; state?: string }) => ({
    jobId: String(data?.jobId ?? ""),
    state: String(data?.state ?? ""),
  }))
  .handler(async ({ data }) => {
    const { currentAdmin } = await import("./admin.server");
    if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
    const { rebuildProgress, latestRebuild, setRebuildState } = await import("./catalog-rebuild.server");
    if (data.jobId && (data.state === "paused" || data.state === "running"))
      return setRebuildState(data.jobId, data.state);
    return data.jobId ? rebuildProgress(data.jobId) : await latestRebuild();
  });
