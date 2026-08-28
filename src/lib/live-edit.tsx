import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAdminIdentity, type AdminIdentity } from "@/lib/use-admin";

const STORAGE_KEY = "ghe-live-edit";

type LiveEditValue = {
  /** Signed-in admin (null for customers). */
  admin: AdminIdentity;
  /** True when the admin turned on direct on-page editing. */
  editing: boolean;
  setEditing: (value: boolean) => void;
  toggle: () => void;
};

const LiveEditContext = createContext<LiveEditValue>({
  admin: null,
  editing: false,
  setEditing: () => undefined,
  toggle: () => undefined,
});

/**
 * Lets signed-in admins edit the live site directly (no /admin round-trip).
 * The on/off choice is remembered locally so it survives navigation & reloads.
 */
export function LiveEditProvider({ children }: { children: ReactNode }) {
  const admin = useAdminIdentity();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      setEditing(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, editing ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [editing]);

  const value = useMemo<LiveEditValue>(
    () => ({
      admin,
      editing: Boolean(admin) && editing,
      setEditing,
      toggle: () => setEditing((v) => !v),
    }),
    [admin, editing],
  );

  return <LiveEditContext.Provider value={value}>{children}</LiveEditContext.Provider>;
}

export function useLiveEdit() {
  return useContext(LiveEditContext);
}
