import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  image_url: string | null;
  stock: number;
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
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      const maxQty = item.stock > 0 ? item.stock : 99;
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
    setItems((prev) =>
      prev
        .map((i) =>
          i.product_id === productId
            ? { ...i, qty: Math.max(1, Math.min(i.stock > 0 ? i.stock : 99, qty)) }
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
