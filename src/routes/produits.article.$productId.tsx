import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { ArrowLeft, Phone, ShoppingCart } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductGallery } from "@/components/ProductGallery";
import { useI18n } from "@/lib/i18n";
import { pathOf, type SiteData } from "@/lib/catalog-types";
import { COMPANY, productWhatsappMessage, whatsappLink } from "@/lib/company";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produits/article/$productId")({
  head: () => ({
    meta: [
      { title: "Fiche produit | Ghandi Home Electro" },
      {
        name: "description",
        content:
          "Caractéristiques, spécifications techniques, prix et disponibilité de cet appareil électroménager chez Ghandi Home Electro, Casablanca.",
      },
      { property: "og:title", content: "Fiche produit | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Caractéristiques, prix et disponibilité de cet appareil chez Ghandi Home Electro.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-5 py-32 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <Link to="/produits" className="mt-4 inline-block font-semibold text-brand">
          ← Produits
        </Link>
      </div>
    </SiteLayout>
  ),
});

function ProductDetail() {
  const { t } = useI18n();
  const { add } = useCart();
  const { productId } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const product = data.products.find((p) => p.id === productId);

  if (!product) throw notFound();

  const trail = pathOf(data.nodes, product.node_id);
  const inStock = product.stock > 0;
  const specs = product.specifications ?? [];

  // Original manufacturer slideshow: main image first, then the full gallery.
  const images = [product.image_url, ...(product.gallery ?? [])]
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index);

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-10">
        <Link
          to="/produits"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("product.back")}
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <ProductGallery images={images} alt={product.name} />

          <div>
            {trail.length > 0 && (
              <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-brand uppercase">
                {trail.map((node, index) => (
                  <span key={node.id} className="inline-flex items-center gap-1.5">
                    {index > 0 && <span className="text-foreground/30">/</span>}
                    <Link
                      to="/produits/$"
                      params={{ _splat: trail.slice(0, index + 1).map((n) => n.slug).join("/") }}
                      className="hover:underline"
                    >
                      {node.name}
                    </Link>
                  </span>
                ))}
              </nav>
            )}

            {product.brand && (
              <p className="mt-4 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
                {product.brand}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{product.name}</h1>
            {product.serial_number && (
              <p className="mt-2 text-sm text-foreground/60">
                {t("product.serial")} : <span className="font-semibold">{product.serial_number}</span>
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4">
              {product.price !== null && (
                <p className="text-3xl font-bold text-brand">
                  {product.price.toLocaleString("fr-MA")} MAD
                </p>
              )}
              <span
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold",
                  inStock ? "bg-brand-soft text-brand-deep" : "bg-destructive/10 text-destructive",
                )}
              >
                {inStock ? t("product.inStock") : t("product.outOfStock")}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {inStock && (
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-brand-soft"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                  <button
                    type="button"
                    aria-label="Augmenter la quantité"
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-brand-soft"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={!inStock}
                onClick={() => {
                  add(
                    {
                      product_id: product.id,
                      name: product.name,
                      brand: product.brand ?? "",
                      price: product.price ?? 0,
                      image_url: product.image_url,
                      stock: product.stock,
                    },
                    qty,
                  );
                  toast.success("Ajouté au panier", {
                    description: `${qty} × ${product.name}`,
                  });
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform",
                  inStock
                    ? "text-primary-foreground shadow-[var(--shadow-soft)] hover:scale-[1.02] active:scale-[0.98]"
                    : "cursor-not-allowed border border-border bg-muted text-foreground/45",
                )}
                {...(inStock ? { style: { background: "var(--gradient-brand)" } } : {})}
              >
                <ShoppingCart className="h-4 w-4" />
                {inStock ? "Ajouter au panier" : t("product.outOfStock")}
              </button>

              <a
                href={whatsappLink(productWhatsappMessage(product))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.72_0.17_147)] px-6 py-3 text-sm font-semibold text-[oklch(1_0_0)] shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
              >
                <svg viewBox="0 0 32 32" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm0 21.8a9.7 9.7 0 0 1-5.03-1.36l-.36-.21-3.77.89.9-3.67-.23-.38A9.75 9.75 0 0 1 6.23 16c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8Z" />
                </svg>
                WhatsApp
              </a>
              <a
                href={COMPANY.phoneHref}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground/75 transition-colors hover:border-brand/50 hover:text-brand"
              >
                <Phone className="h-4 w-4" /> {t("product.ask")}
              </a>
            </div>

            {product.characteristics && (
              <div className="mt-8 border-t border-border pt-6">
                <h2 className="text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  {t("product.characteristics")}
                </h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground/75">
                  {product.characteristics}
                </p>
              </div>
            )}
          </div>
        </div>

        {specs.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-semibold">Spécifications techniques</h2>
            <dl className="mt-4 grid gap-x-10 sm:grid-cols-2">
              {specs.map((spec, i) => (
                <div
                  key={`${spec.label}-${i}`}
                  className="flex items-baseline justify-between gap-6 border-b border-border/70 py-2.5 text-sm"
                >
                  <dt className="text-foreground/60">{spec.label}</dt>
                  <dd className="text-end font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
