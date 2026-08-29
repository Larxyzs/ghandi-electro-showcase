import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { formatMAD } from "@/lib/company";

export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { items, setQty, remove, total } = useCart();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-brand" /> Mon panier
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-foreground/60">
              <ShoppingCart className="h-10 w-10 text-brand/40" />
              <p className="text-sm">Votre panier est vide.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <li
                  key={item.product_id}
                  className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-soft/50">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => remove(item.product_id)}
                        aria-label="Retirer"
                        className="shrink-0 text-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {item.brand && (
                      <p className="text-xs font-semibold tracking-wide text-brand uppercase">
                        {item.brand}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-full border border-border px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, item.qty - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/70 hover:bg-brand-soft"
                          aria-label="Diminuer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(item.product_id, item.qty + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/70 hover:bg-brand-soft"
                          aria-label="Augmenter"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-brand">
                        {formatMAD((item.price * item.qty))}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-brand">{formatMAD(total)}</span>
            </div>
            <Link
              to="/panier"
              onClick={() => onOpenChange(false)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
              style={{ background: "var(--gradient-brand)" }}
            >
              Commander
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
