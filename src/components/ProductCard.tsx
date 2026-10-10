import { Link } from "@tanstack/react-router";
import { Heart, PackageSearch, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { isNewProduct, type Product } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { formatDH, priceRequestMessage, whatsappLink } from "@/lib/company";
import { toggleFavorite, useFavorites } from "@/lib/favorites";

export function addProductToCart(
  add: ReturnType<typeof useCart>["add"],
  product: Product,
  qty = 1,
) {
  add(
    {
      product_id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      price: product.price ?? 0,
      price_on_request: product.price === null,
      image_url: product.image_url,
      stock: product.stock,
    },
    qty,
  );
}

export function ProductCard({ product }: { product: Product }) {
  const tr = useDynamicText();
  const { add } = useCart();
  const favorites = useFavorites();
  const isFav = favorites.includes(product.id);
  const second = product.gallery?.find((g) => g !== product.image_url);
  const reference = product.model || product.serial_number;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      to="/produits/article/$productId"
      params={{ productId: product.id }}
      className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
    >
      <div className="relative aspect-square overflow-hidden bg-card">
        {product.image_url ? (
          <>
            <img
              src={product.image_url}
              alt={tr(product.name)}
              loading="lazy"
              className={cn(
                "h-full w-full object-contain p-4 transition-opacity duration-300",
                second && "md:group-hover:opacity-0",
              )}
            />
            {second && (
              <img
                src={second}
                alt=""
                loading="lazy"
                className="absolute inset-0 hidden h-full w-full object-contain p-4 opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-brand/40">
            <PackageSearch className="h-10 w-10" />
          </div>
        )}
        {isNewProduct(product) && (
          <span className="absolute top-2 start-2 rounded bg-brand px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground uppercase">
            Nouveau
          </span>
        )}
        <button
          type="button"
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          onClick={(e) => {
            stop(e);
            toggleFavorite(product.id);
          }}
          className="absolute top-2 end-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-background/90 text-foreground/60 hover:text-brand"
        >
          <Heart className={cn("h-4 w-4", isFav && "fill-brand text-brand")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 border-t border-border/60 p-3 sm:p-4">
        {product.brand && (
          <p className="text-[0.7rem] font-semibold tracking-wide text-foreground/50 uppercase">
            {product.brand}
          </p>
        )}
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold group-hover:text-brand">
          {tr(product.name)}
        </h3>
        {reference && <p className="truncate text-xs text-foreground/45">{reference}</p>}

        <div className="mt-auto pt-2">
          {product.price !== null ? (
            <p className="text-lg font-bold text-foreground">{formatDH(product.price)}</p>
          ) : (
            <p className="text-sm font-semibold text-brand-deep">Prix sur demande</p>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            {product.price === null && (
              <a
                href={whatsappLink(priceRequestMessage(product))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-whatsapp/50 py-1.5 text-center text-xs font-semibold text-whatsapp hover:bg-whatsapp/10"
              >
                Demander le prix
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                addProductToCart(add, product);
                toast.success("Ajouté au panier", { description: tr(product.name) });
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Ajouter au panier
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
