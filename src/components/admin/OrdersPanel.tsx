import { useEffect, useMemo, useState } from "react";
import { Phone, Trash2 } from "lucide-react";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatus,
} from "@/lib/orders-types";
import { cn } from "@/lib/utils";
import { formatMAD } from "@/lib/company";

type OrdersPanelProps = {
  list: () => Promise<Order[]>;
  setStatus: (id: string, status: OrderStatus) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  nouveau: "bg-brand text-primary-foreground",
  en_cours: "bg-amber-100 text-amber-800",
  termine: "bg-emerald-100 text-emerald-800",
  annule: "bg-destructive/10 text-destructive",
};

export function OrdersPanel({ list, setStatus, remove }: OrdersPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await list();
      setOrders(data);
    } catch {
      setError("Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const handleStatus = async (id: string, status: OrderStatus) => {
    setBusyId(id);
    const prev = orders;
    setOrders((current) => current.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      await setStatus(id, status);
    } catch {
      setOrders(prev);
      setError("Impossible de mettre à jour le statut.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette commande ?")) return;
    setBusyId(id);
    try {
      await remove(id);
      setOrders((current) => current.filter((o) => o.id !== id));
    } catch {
      setError("Impossible de supprimer la commande.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
            filter === "all"
              ? "border-brand bg-brand text-primary-foreground"
              : "border-border text-foreground/70 hover:border-brand/40",
          )}
        >
          Toutes ({orders.length})
        </button>
        {ORDER_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === status
                ? "border-brand bg-brand text-primary-foreground"
                : "border-border text-foreground/70 hover:border-brand/40",
            )}
          >
            {ORDER_STATUS_LABELS[status]} ({orders.filter((o) => o.status === status).length})
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-foreground/60">Chargement des commandes...</p>}

      {!loading && filtered.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-foreground/60">
          Aucune commande pour ce filtre.
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {filtered.map((order) => (
          <li
            key={order.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold text-brand">{order.reference}</p>
                <p className="text-xs text-foreground/50">
                  {new Date(order.created_at).toLocaleString("fr-MA")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    STATUS_BADGE[order.status],
                  )}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <select
                  value={order.status}
                  disabled={busyId === order.id}
                  onChange={(e) => handleStatus(order.id, e.target.value as OrderStatus)}
                  className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60"
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleDelete(order.id)}
                  disabled={busyId === order.id}
                  aria-label="Supprimer"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground/50 transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs tracking-wide text-foreground/50 uppercase">Client</p>
                <p className="font-semibold">{order.full_name}</p>
                <a
                  href={`tel:${order.phone}`}
                  className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {order.phone}
                </a>
              </div>
              <div>
                <p className="text-xs tracking-wide text-foreground/50 uppercase">Adresse</p>
                <p className="text-sm">
                  {order.address}
                  {order.city ? `, ${order.city}` : ""}
                </p>
                {order.note && <p className="mt-1 text-xs text-foreground/60">Note : {order.note}</p>}
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <ul className="flex flex-col gap-1.5">
                {order.items.map((item, i) => (
                  <li key={`${item.product_id}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-foreground/75">
                      {item.qty} × {item.name}
                      {item.brand ? ` (${item.brand})` : ""}
                    </span>
                    <span className="font-semibold">
                      {formatMAD((item.price * item.qty))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="text-brand">{formatMAD(order.total)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
