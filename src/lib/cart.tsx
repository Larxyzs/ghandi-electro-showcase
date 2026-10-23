import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from 'sonner';
import { availabilityOf } from './price-stock';

export type CartItem = {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  /** No shop price yet: confirmed by phone. */
  price_on_request?: boolean;
  image_url: string | null;
  stock: number;
  availability?: string;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  count: number;
  total: number;
};

const STORAGE_KEY = "ghe-cart";

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore corrupted storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  }, [items, hydrated]);

  const add: CartContextValue["add"] = (item, qty = 1) => {
    if (availabilityOf(item) !== 'in_stock') { toast.error('Produit indisponible. Contactez-nous sur WhatsApp.'); return; }
    const existingQty = items.find(i => i.product_id === item.product_id)?.qty ?? 0;
    if (existingQty + qty > item.stock) { toast.error(`Il n’en reste que ${item.stock}`); return; }
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      const maxQty = item.stock;
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, qty: Math.min(maxQty, i.qty + qty) }
            : i,
        );
      }
      return [...prev, { ...item, qty: Math.min(maxQty, Math.max(1, qty)) }];
    });
  };

  const remove: CartContextValue["remove"] = (productId) => {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const setQty: CartContextValue["setQty"] = (productId, qty) => {
    const item = items.find(i => i.product_id === productId);
    if (!item) return;
    if (qty > item.stock) { toast.error(`Il n’en reste que ${item.stock}`); return; }
    setItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId
            ? { ...i, qty: Math.max(1, Math.min(i.stock, qty)) }
            : i,
        )
        .filter((i) => i.qty > 0),
    );
  };

  const clear = () => setItems([]);

  const { count, total } = useMemo(() => {
    return items.reduce(
      (acc, i) => ({ count: acc.count + i.qty, total: acc.total + i.qty * i.price }),
      { count: 0, total: 0 },
    );
  }, [items]);

  const value = useMemo(
    () => ({ items, add, remove, setQty, clear, count, total }),
    [items, count, total],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
