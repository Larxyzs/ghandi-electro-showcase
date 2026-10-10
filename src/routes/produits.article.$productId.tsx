import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import {
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Home,
  Maximize2,
  Minus,
  Phone,
  Plus,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard, addProductToCart } from "@/components/ProductCard";
import { useDynamicText } from "@/lib/dynamic-text";
import { useLiveEdit } from "@/lib/live-edit";
import { ProductLiveEditor } from "@/components/live/ProductLiveEditor";
import { dedupeGallery, pathOf, specSections, type Product, type SiteData } from "@/lib/catalog-types";
import { COMPANY, formatDH, priceRequestMessage, productWhatsappMessage, whatsappLink } from "@/lib/company";
import { useCart } from "@/lib/cart";
import { pushRecent, useRecent } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produits/article/$productId")({
  head: ({ params, matches }) => {
    const data = matches[0]?.loaderData as SiteData | undefined;
    const p = data?.products.find((x) => x.id === params.productId);
    if (!p) {
      return { meta: [{ title: "Fiche produit | Ghandi Home Electro" }, { name: "robots", content: "noindex" }] };
    }
    const ref = p.model || p.serial_number;
    const title = `${p.name}${p.brand ? ` ${p.brand}` : ""}${ref && !p.name.includes(ref) ? ` ${ref}` : ""} – Ghandi Home Electro Casablanca`;
    const description = `${p.brand} ${p.name}${ref ? ` (réf. ${ref})` : ""} chez Ghandi Home Electro, Casablanca. ${p.price !== null ? `Prix : ${p.price} DH.` : "Prix sur demande."} Livraison partout au Maroc, paiement à la livraison.`;
    const image = p.image_url && p.image_url.startsWith("https://") ? p.image_url : null;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
      sku: ref || undefined,
      mpn: ref || undefined,
      image: image ? [image] : undefined,
      description,
      ...(p.price !== null
        ? { offers: { "@type": "Offer", priceCurrency: "MAD", price: p.price, availability: "https://schema.org/InStock" } }
        : {}),
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
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
  const tr = useDynamicText();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"specs" | "delivery">("specs");
  const [full, setFull] = useState<number | null>(null);
  const { admin, editing, setEditing } = useLiveEdit();
  const recentIds = useRecent();

  const { productId } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const product = data.products.find((p) => p.id === productId);

  useEffect(() => {
    if (product) pushRecent(product.id);
  }, [product]);

  if (!product) throw notFound();

  const trail = pathOf(data.nodes, product.node_id);
  const sections = specSections(product);
  const keyPoints = sections[0]?.rows.slice(0, 6) ?? [];
  const reference = product.model || product.serial_number;
  const images = dedupeGallery([product.image_url, ...(product.gallery ?? [])]).slice(0, 15);
  const similar = data.products.filter((p) => p.id !== product.id && p.node_id === product.node_id).slice(0, 8);
  const recent = recentIds
    .filter((id) => id !== product.id)
    .map((id) => data.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 8);
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-7xl px-5 py-6">
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-foreground/65">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-brand"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          {trail.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
              <Link to="/produits/$" params={{ _splat: trail.slice(0, index + 1).map((n) => n.slug).join("/") }} className="hover:text-brand">
                {tr(node.name)}
              </Link>
            </span>
          ))}
        </nav>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <div className="relative">
            <ProductGallery images={images} alt={tr(product.name)} />
            {images.length > 0 && (
              <button type="button" onClick={() => setFull(0)} aria-label="Plein écran"
                className="absolute top-3 start-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/90">
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            {product.brand && <p className="text-sm font-bold tracking-wide text-brand uppercase">{product.brand}</p>}
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">{tr(product.name)}</h1>
            {reference && <p className="mt-1 text-sm text-foreground/55">Réf. : <span className="font-semibold">{reference}</span></p>}

            <div className="mt-5 rounded-lg border border-border bg-brand-soft/30 p-4">
              {product.price !== null ? (
                <p className="text-3xl font-bold">{formatDH(product.price)}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl font-bold text-brand-deep">Prix sur demande</p>
                  <a href={whatsappLink(priceRequestMessage(product))} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-whatsapp/50 px-4 py-1.5 text-sm font-semibold text-whatsapp">
                    <WaIcon className="h-4 w-4" /> Demander le prix
                  </a>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                <button type="button" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-brand-soft"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                <button type="button" aria-label="Plus" onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-brand-soft"><Plus className="h-4 w-4" /></button>
              </div>
              <button type="button"
                onClick={() => {
                  addProductToCart(add, product, qty);
                  toast.success("Ajouté au panier", { description: `${qty} × ${tr(product.name)}` });
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground sm:flex-none">
                <ShoppingCart className="h-4 w-4" /> Ajouter au panier
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <a href={whatsappLink(`${productWhatsappMessage(product)} ${pageUrl}`)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-3 text-sm font-semibold text-primary-foreground">
                <WaIcon className="h-4 w-4" /> Commander sur WhatsApp
              </a>
              <a href={COMPANY.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold hover:border-brand hover:text-brand">
                <Phone className="h-4 w-4" /> Appeler
              </a>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-foreground/70">
              <li className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> Livraison à Casablanca et partout au Maroc</li>
              <li className="flex items-center gap-2"><Banknote className="h-4 w-4 text-brand" /> Paiement à la livraison</li>
            </ul>

            {keyPoints.length > 0 && (
              <div className="mt-6 rounded-lg border border-border p-4">
                <h2 className="text-sm font-bold">Points clés</h2>
                <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
                  {keyPoints.map((r, i) => (
                    <div key={i} className="flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
                      <dt className="text-foreground/60">{tr(r.label)}</dt>
                      <dd className="text-end font-medium">{tr(r.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.characteristics && (
              <p className="mt-6 leading-relaxed whitespace-pre-line text-foreground/75">{tr(product.characteristics)}</p>
            )}

            {admin && product.source_url && (
              <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                <ExternalLink className="h-3.5 w-3.5" /> Page officielle (admin)
              </a>
            )}
          </div>
        </div>

        {editing && admin && (
          <ProductLiveEditor product={product} nodes={data.nodes} onClose={() => setEditing(false)} />
        )}

        <div className="mt-12">
          <div className="flex gap-2 border-b border-border">
            {([["specs", "Caractéristiques"], ["delivery", "Livraison"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={cn("-mb-px border-b-2 px-4 py-3 text-sm font-semibold", tab === k ? "border-brand text-brand" : "border-transparent text-foreground/60")}>
                {l}
              </button>
            ))}
          </div>
          {tab === "specs" ? (
            sections.length === 0 ? (
              <p className="py-6 text-sm text-foreground/60">Caractéristiques disponibles sur demande.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {sections.map((group, g) => (
                  <details key={g} open={g < 2} className="group rounded-lg border border-border md:open:block [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between bg-brand-soft/40 px-4 py-3 text-sm font-bold">
                      {tr(group.title || "Caractéristiques")}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <table className="w-full text-sm">
                      <tbody>
                        {group.rows.map((r, i) => (
                          <tr key={i} className="border-t border-border/60">
                            <th className="w-1/2 px-4 py-2 text-start font-normal text-foreground/60">{tr(r.label)}</th>
                            <td className="px-4 py-2 font-medium">{tr(r.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2 py-6 text-sm text-foreground/75">
              <p>Livraison à Casablanca et partout au Maroc. Délai et frais confirmés par téléphone.</p>
              <p>Paiement à la livraison. Retrait possible au magasin : {COMPANY.address}.</p>
            </div>
          )}
        </div>

        {similar.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold">Produits similaires</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
              {similar.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold">Vous avez vu récemment</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
              {recent.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </section>

      {full !== null && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink/95">
          <div className="flex justify-end p-3">
            <button type="button" onClick={() => setFull(null)} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full bg-background"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4">
            <img src={images[full]} alt="" className="max-h-full max-w-full rounded bg-card object-contain" />
            <button type="button" aria-label="Précédent" onClick={() => setFull((full - 1 + images.length) % images.length)} className="absolute start-3 grid h-11 w-11 place-items-center rounded-full bg-background"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Suivant" onClick={() => setFull((full + 1) % images.length)} className="absolute end-3 grid h-11 w-11 place-items-center rounded-full bg-background"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <p className="pb-4 text-center text-sm text-primary-foreground">{full + 1} / {images.length}</p>
        </div>
      )}
    </SiteLayout>
  );
}
