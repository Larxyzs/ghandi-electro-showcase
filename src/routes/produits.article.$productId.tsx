import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { ArrowLeft, PackageSearch, Phone } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Reveal } from "@/components/Reveal";
import { ZoomImage } from "@/components/ZoomImage";
import { useI18n } from "@/lib/i18n";
import type { SiteData } from "@/lib/catalog-types";
import { COMPANY } from "@/lib/company";
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

  const category = data.categories.find((c) => c.id === product.category_id);
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
            {category && (
              <span className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
                {category.name}
              </span>
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

            {product.description && (
              <div className="mt-8">
                <h2 className="text-sm font-semibold tracking-wide text-foreground/55 uppercase">
                  {t("product.description")}
                </h2>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-foreground/75">
                  {product.description}
                </p>
              </div>
            )}

            <a
              href={COMPANY.phoneHref}
              className="mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03]"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Phone className="h-4 w-4" /> {t("product.ask")}
            </a>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}