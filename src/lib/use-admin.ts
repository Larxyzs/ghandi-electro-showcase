import { useEffect, useState } from "react";
import { adminStatus } from "./admin.functions";

export type AdminIdentity = { username: string; role: string } | null;

/**
 * Client-side check of the admin session cookie.
 * Used to show admin-only affordances (Admin shortcut, source links).
 */
export function useAdminIdentity() {
  const [identity, setIdentity] = useState<AdminIdentity>(null);

  useEffect(() => {
    let alive = true;
    void adminStatus()
      .then((result) => {
        if (!alive) return;
        if (result?.authenticated && result.username) {
          setIdentity({ username: result.username, role: result.role ?? "staff" });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return identity;
}
