import { Link } from "@tanstack/react-router";
import { PackageSearch, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/catalog-types";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { t } = useI18n();
  const { add } = useCart();
  const inStock = product.stock > 0;

  const handleAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!inStock) return;
    add({
      product_id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      price: product.price ?? 0,
      image_url: product.image_url,
      stock: product.stock,
    });
    toast.success("Ajouté au panier", { description: product.name });
  };


  return (
    <Link
      to="/produits/article/$productId"
      params={{ productId: product.id }}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-2 hover:border-brand/40"
    >
      <div className="relative aspect-square overflow-hidden bg-[oklch(1_0_0)]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-brand/40">
            <PackageSearch className="h-10 w-10" />
          </div>
        )}

        <span
          className={cn(
            "absolute top-3 end-3 rounded-full px-3 py-1 text-[0.7rem] font-semibold",
            product.stock > 0
              ? "bg-brand text-primary-foreground"
              : "bg-destructive text-destructive-foreground",
          )}
        >
          {product.stock > 0 ? t("product.inStock") : t("product.outOfStock")}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-lg font-semibold">{product.name}</h2>
        {product.brand && (
          <p className="mt-1 text-xs font-semibold tracking-wide text-brand uppercase">
            {product.brand}
          </p>
        )}
        {product.serial_number && (
          <p className="mt-1 text-xs text-foreground/50">
            {t("product.serial")} : {product.serial_number}
          </p>
        )}
        <p className="mt-3 line-clamp-2 text-sm text-foreground/65">{product.characteristics}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {product.price !== null ? (
            <p className="text-lg font-bold text-brand">
              {product.price.toLocaleString("fr-MA")} MAD
            </p>
          ) : (
            <span />
          )}
          {inStock && (
            <button
              type="button"
              onClick={handleAdd}
              aria-label="Ajouter au panier"
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105 active:scale-95"
              style={{ background: "var(--gradient-brand)" }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Ajouter
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
