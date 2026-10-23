import { Link } from "@tanstack/react-router";
import { Heart, PackageSearch, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { isNewProduct, type Product } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import { formatDH, priceRequestMessage, useCompany, whatsappLinkTo } from "@/lib/company";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { useCompare } from "@/lib/compare";
import { keySpecs } from "@/lib/key-specs";
import { availabilityOf, AVAILABILITY_LABELS } from '@/lib/price-stock';
import { Button } from '@/components/ui/button';

export function addProductToCart(
  add: ReturnType<typeof useCart>["add"],
  product: Product,
  qty = 1,
) {
  if (availabilityOf(product) !== 'in_stock') { toast.error('Produit indisponible au panier. Contactez-nous sur WhatsApp.'); return false; }
  if (qty > product.stock) { toast.error(`Il n’en reste que ${product.stock}`); return false; }
  add(
    {
      product_id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      price: product.price ?? 0,
      price_on_request: !product.price,
      image_url: product.image_url,
      stock: product.stock,
      availability: availabilityOf(product),
    },
    qty,
  );
  return true;
}

export function ProductCard({ product, variant = "grid" }: { product: Product; variant?: "grid" | "list" }) {
  const tr = useDynamicText();
  const { add } = useCart();
  const company = useCompany();
  const favorites = useFavorites();
  const compare = useCompare();
  const isFav = favorites.includes(product.id);
  const second = product.gallery?.find((g) => g !== product.image_url);
  const reference = product.model || product.serial_number;
  const list = variant === "list";
  const specs = keySpecs(product, list ? 5 : 3);
  const availability = availabilityOf(product);
  const waMessage = availability === 'out_of_stock' ? `Bonjour, prévenez-moi quand ${product.brand} ${product.name} (réf. ${reference}) sera de nouveau disponible.` : `Bonjour, je souhaite commander ${product.brand} ${product.name} (réf. ${reference}). https://ghandihomeelectro.com/produits/article/${product.id}`;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const actions = (
    <div className="pointer-events-auto mt-2 flex flex-col gap-1.5">
      {!product.price && (
        <a href={whatsappLinkTo(company.whatsappNumber, priceRequestMessage(product))} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded-md border border-whatsapp/60 py-1.5 text-center text-xs font-bold text-whatsapp hover:bg-whatsapp/10">
          Demander le prix
        </a>
      )}
      {availability === 'in_stock' ? <Button type="button"
        onClick={(e) => {
          stop(e);
          if (addProductToCart(add, product)) toast.success("Ajouté au panier", { description: tr(product.name) });
        }}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand py-2.5 text-xs font-bold text-brand-foreground hover:bg-brand-deep">
        <ShoppingCart className="h-3.5 w-3.5" /> Ajouter au panier
      </Button> : <Button asChild className="h-auto whitespace-normal bg-whatsapp py-2.5 text-xs font-bold text-background hover:bg-whatsapp/90"><a href={whatsappLinkTo(company.whatsappNumber,waMessage)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{availability === 'out_of_stock' ? 'Me prévenir du retour' : 'Commander sur WhatsApp'}</a></Button>}
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={compare.has(product.id)} onChange={() => compare.toggle(product.id)} className="accent-brand" />
        Comparer
      </label>
    </div>
  );

  const price = product.price && product.price > 0 ? (
    <p className="text-xl font-bold text-foreground">{formatDH(product.price)}</p>
  ) : (
    <p className="text-sm font-bold text-text-2">Prix sur demande</p>
  );

  return (
    <div className={cn("group relative flex h-full overflow-hidden rounded-lg border border-border bg-card p-3 transition hover:border-input hover:shadow-[var(--shadow-hover)]", list ? "flex-row gap-4" : "flex-col")}>
      <Link to="/produits/article/$productId" params={{ productId: product.id }} aria-label={tr(product.name)} className="absolute inset-0 z-0" />
      <div className={cn("pointer-events-none relative shrink-0 overflow-hidden bg-card", list ? "aspect-square w-32 sm:w-44" : "aspect-square w-full")}>
        {product.image_url ? (
          <>
            <img src={product.image_url} alt={tr(product.name)} loading="lazy"
              className={cn("h-full w-full object-contain transition-opacity duration-300", second && "md:group-hover:opacity-0")} />
            {second && (
              <img src={second} alt="" loading="lazy"
                className="absolute inset-0 hidden h-full w-full object-contain opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100" />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-text-3"><PackageSearch className="h-10 w-10" /></div>
        )}
        {isNewProduct(product) && (
          <span className="absolute top-0 start-0 rounded bg-brand px-2 py-0.5 text-[0.65rem] font-bold text-brand-foreground uppercase">Nouveau</span>
        )}
      </div>
      <button type="button" aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        onClick={(e) => { stop(e); toggleFavorite(product.id); }}
        className="absolute top-2 end-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-card text-text-2 hover:text-foreground">
        <Heart className={cn("h-4 w-4", isFav && "fill-brand text-brand")} />
      </button>

      <div className={cn("pointer-events-none relative flex flex-1 gap-1", list ? "flex-col sm:flex-row sm:gap-6" : "flex-col pt-3")}>
        <div className="min-w-0 flex-1">
          {product.brand && <p className="text-[0.7rem] font-medium tracking-wide text-text-3 uppercase">{product.brand}</p>}
          <h3 className="line-clamp-3 text-sm leading-snug font-medium">{tr(product.name)}</h3>
          {reference && <p className="truncate text-xs text-text-3">{reference}</p>}
          {specs.length > 0 && (list ? (
            <ul className="mt-2 list-disc space-y-0.5 ps-4 text-xs text-text-2">{specs.map((s) => <li key={s}>{s}</li>)}</ul>
          ) : (
            <p className="mt-1 line-clamp-1 text-xs text-text-2">{specs.join(" · ")}</p>
          ))}
        </div>
        <div className={cn(list ? "sm:w-48" : "mt-auto pt-2")}>
          {price}
          <p className={cn('mt-2 text-xs font-bold', availability === 'in_stock' ? 'text-stock-ok' : availability === 'on_request' ? 'text-whatsapp' : 'text-text-2')}>{AVAILABILITY_LABELS[availability]}</p>
          {actions}
        </div>
      </div>
    </div>
  );
}
