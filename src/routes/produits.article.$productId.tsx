import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { ArrowLeft, PackageSearch, Phone } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductStory } from "@/components/ProductStory";
import { Reveal } from "@/components/Reveal";
import { ZoomImage } from "@/components/ZoomImage";
import { useI18n } from "@/lib/i18n";
import { pathOf, type SiteData } from "@/lib/catalog-types";
import { COMPANY, productWhatsappMessage, whatsappLink } from "@/lib/company";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produits/article/$productId")({
  head: () => ({
    meta: [
      { title: "Produit | Ghandi Home Electro" },
      {
        name: "description",
        content: "Détails, disponibilité et caractéristiques de cet appareil chez Ghandi Home Electro.",
      },
      { property: "og:title", content: "Produit | Ghandi Home Electro" },
      {
        property: "og:description",
        content: "Détails et disponibilité de cet appareil chez Ghandi Home Electro.",
      },
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
  const { productId } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const product = data.products.find((p) => p.id === productId);

  if (!product) throw notFound();

  const trail = pathOf(data.nodes, product.node_id);
  const inStock = product.stock > 0;

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-6xl px-5 py-14">
        <Link
          to="/produits"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {t("product.back")}
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          <Reveal variant="left">
            {product.image_url ? (
              <ZoomImage src={product.image_url} alt={product.name} hint={t("product.zoomHint")} />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-[2rem] border border-border bg-brand-soft/50 text-brand/40">
                <PackageSearch className="h-14 w-14" />
              </div>
            )}
          </Reveal>

          <Reveal variant="right" delay={120}>
            {trail.length > 0 && (
              <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-brand uppercase">
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
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{product.name}</h1>

            <span
              className={cn(
                "mt-5 inline-block rounded-full px-4 py-1.5 text-sm font-semibold",
                inStock
                  ? "bg-brand-soft text-brand-deep"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {inStock ? t("product.inStock") : t("product.outOfStock")}
            </span>

            {product.price !== null && (
              <p className="mt-6 text-3xl font-bold text-brand">
                {product.price.toLocaleString("fr-MA")} MAD
              </p>
            )}

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {product.serial_number && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <dt className="text-xs tracking-wide text-foreground/55 uppercase">
                    {t("product.serial")}
                  </dt>
                  <dd className="mt-1 font-semibold">{product.serial_number}</dd>
                </div>
              )}
              <div className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-xs tracking-wide text-foreground/55 uppercase">
                  {t("product.stock")}
                </dt>
                <dd className="mt-1 font-semibold">{product.stock}</dd>
              </div>
            </dl>

            {product.characteristics && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  {t("product.characteristics")}
                </h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground/75">
                  {product.characteristics}
                </p>
              </div>
            )}

            {(product.specifications ?? []).length > 0 && (
              <div className="mt-8 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  Spécifications
                </h2>
                <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
                  {(product.specifications ?? []).slice(0, 8).map((spec, i) => (
                    <div
                      key={`${spec.label}-${i}`}
                      className="flex items-baseline justify-between gap-4 border-b border-border/70 py-2 text-sm"
                    >
                      <dt className="text-foreground/60">{spec.label}</dt>
                      <dd className="text-end font-medium">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <a
              href={COMPANY.phoneHref}
              className="mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03]"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Phone className="h-4 w-4" /> {t("product.ask")}
            </a>

            <a
              href={whatsappLink(productWhatsappMessage(product))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 ms-0 inline-flex items-center gap-2 rounded-full bg-[oklch(0.72_0.17_147)] px-6 py-3 text-sm font-semibold text-[oklch(1_0_0)] shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03] sm:ms-3"
            >
              <svg viewBox="0 0 32 32" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm0 21.8a9.7 9.7 0 0 1-5.03-1.36l-.36-.21-3.77.89.9-3.67-.23-.38A9.75 9.75 0 0 1 6.23 16c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8Z" />
              </svg>
              Discuter de ce produit sur WhatsApp
            </a>
          </Reveal>
        </div>
      </section>

      <ProductStory product={product} />
    </SiteLayout>
  );
}