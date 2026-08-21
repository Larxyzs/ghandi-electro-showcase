import { Link } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import type { Product } from "@/lib/catalog-types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  const { t } = useI18n();
  return (
    <Link
      to="/produits/article/$productId"
      params={{ productId: product.id }}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-2 hover:border-brand/40"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-brand-soft/50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
        <p className="mt-3 line-clamp-2 text-sm text-foreground/65">{product.description}</p>
        {product.price !== null && (
          <p className="mt-4 text-lg font-bold text-brand">
            {product.price.toLocaleString("fr-MA")} MAD
          </p>
        )}
      </div>
    </Link>
  );
}
