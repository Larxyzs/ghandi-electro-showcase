import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Banknote,
  Heart,
  Share2,
  Store,
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
import { ancestorAtLevel, dedupeGallery, pathOf, productsIn, specSections, type Product, type SiteData } from "@/lib/catalog-types";
import { keySpecs } from "@/lib/key-specs";
import { useCompare } from "@/lib/compare";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { formatDH, priceRequestMessage, productWhatsappMessage, useCompany, whatsappLinkTo } from "@/lib/company";
import { useCart } from "@/lib/cart";
import { pushRecent, useRecent } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produits/article/$productId")({
  head: ({ params, matches }) => {
    const data = matches[0]?.loaderData as SiteData | undefined;
    const p = data?.products.find((x) => x.id === params.productId);
    if (!p) {
      return { meta: [
        { title: "Produit indisponible | Ghandi Home Electro" },
        { name: "description", content: "Ce produit n'est pas disponible. Retrouvez le catalogue d'électroménager Ghandi Home Electro à Casablanca." },
        { property: "og:title", content: "Produit indisponible | Ghandi Home Electro" },
        { property: "og:description", content: "Retrouvez le catalogue d'électroménager Ghandi Home Electro à Casablanca." },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ] };
    }
    const ref = p.model || p.serial_number;
    const title = `${p.name}${p.brand ? ` ${p.brand}` : ""}${ref && !p.name.includes(ref) ? ` ${ref}` : ""} – Ghandi Home Electro Casablanca`;
    const description = `${p.brand} ${p.name}${ref ? ` (réf. ${ref})` : ""} chez Ghandi Home Electro, Casablanca. ${p.price !== null ? `Prix : ${p.price} DH.` : "Prix sur demande."} Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza, paiement à la livraison.`;
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
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(ld) },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://ghandihomeelectro.com" },
              ...pathOf(data?.nodes ?? [], p.node_id).map((n, i, arr) => ({
                "@type": "ListItem",
                position: i + 2,
                name: n.name,
                item: `https://ghandihomeelectro.com/produits/${arr.slice(0, i + 1).map((x) => x.slug).join("/")}`,
              })),
              { "@type": "ListItem", position: pathOf(data?.nodes ?? [], p.node_id).length + 2, name: p.name },
            ],
          }),
        },
      ],
    };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-5 py-32 text-center">
        <h1 className="text-3xl font-bold">404</h1>
        <Link to="/produits" search={{}} className="mt-4 inline-block font-semibold underline">
          ← Produits
        </Link>
      </div>
    </SiteLayout>
  ),
});

function SpecBox({ title, rows, open, onToggle }: { title: string; rows: { label: string; value: string }[]; open: boolean; onToggle: () => void }) {
  const tr = useDynamicText();
  return (
    <div className="self-start rounded-lg bg-card px-5 py-5 md:px-10 md:py-7">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 text-start">
        <span className="text-lg font-medium md:text-xl">{tr(title || "Caractéristiques")}</span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-brand md:h-14 md:w-14">
          {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </span>
      </button>
      {open && (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <th className="w-2/5 py-3 pe-3 text-start align-top font-normal text-text-2">{tr(r.label)}</th>
                <td className="py-3 align-top font-bold">{tr(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProductDetail() {
  const tr = useDynamicText();
  const { add } = useCart();
  const company = useCompany();
  const [qty, setQty] = useState(1);
  const [full, setFull] = useState<number | null>(null);
  const { admin, editing, setEditing } = useLiveEdit();
  const recentIds = useRecent();
  const favorites = useFavorites();
  const compare = useCompare();
  const buyRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  const [active, setActive] = useState("caracteristiques");

  const { productId } = Route.useParams();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const product = data.products.find((p) => p.id === productId);
  const sections = product ? specSections(product) : [];
  const [openBoxes, setOpenBoxes] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    if (product) pushRecent(product.id);
  }, [product]);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setShowBar(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [product?.id]);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (showBar && mobile) document.body.dataset["buybar"] = "1";
    else delete document.body.dataset["buybar"];
    return () => { delete document.body.dataset["buybar"]; };
  }, [showBar]);
  useEffect(() => {
    const ids = ["description", "caracteristiques", "livraison"];
    const on = () => {
      let cur = ids[0]!;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 200) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  if (!product) throw notFound();

  const trail = pathOf(data.nodes, product.node_id);
  const bullets = keySpecs(product, 6);
  const reference = product.model || product.serial_number;
  const images = dedupeGallery([product.image_url, ...(product.gallery ?? [])]).slice(0, 15);
  const family = ancestorAtLevel(data.nodes, product.node_id, 2) ?? trail.at(-1);
  const similar = (family ? productsIn(data.nodes, data.products, family.id) : []).filter((p) => p.id !== product.id).slice(0, 12);
  const recent = recentIds
    .filter((id) => id !== product.id)
    .map((id) => data.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 8);
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;
  const brand = data.brands?.find((b) => b.name.toLowerCase() === product.brand.toLowerCase());
  const hasDescription = Boolean(product.characteristics?.trim()) || product.marketing_sections.length > 0;
  const isFav = favorites.includes(product.id);
  const addToCart = () => {
    addProductToCart(add, product, qty);
    toast.success("Ajouté au panier", { description: `${qty} × ${tr(product.name)}` });
  };
  const share = async () => {
    try {
      if (navigator.share && window.matchMedia("(max-width: 767px)").matches) await navigator.share({ title: product.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); toast.success("Lien copié"); }
    } catch { /* cancelled */ }
  };
  const allOpen = openBoxes.size === sections.length;
  const facts = [
    { Icon: Truck, t: "Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza" },
    { Icon: Banknote, t: "Paiement à la livraison" },
    { Icon: Store, t: `Retrait au magasin : ${company.shortAddress}` },
  ];
  const tabs = [
    ...(hasDescription ? [["description", "Description"]] : []),
    ["caracteristiques", "Caractéristiques"],
    ["livraison", "Livraison et retrait"],
  ] as [string, string][];

  return (
    <SiteLayout>
      <section className="shell py-4">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-text-2">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          {trail.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-text-3" />
              <Link to="/produits/$" params={{ _splat: trail.slice(0, index + 1).map((n) => n.slug).join("/") }} className="hover:text-foreground">{tr(node.name)}</Link>
            </span>
          ))}
        </nav>

        <div className="panel mt-3 grid gap-6 p-4 md:p-6 lg:grid-cols-2 lg:gap-10">
          <div className="relative">
            <ProductGallery images={images} alt={tr(product.name)} />
            {images.length > 0 && (
              <button type="button" onClick={() => setFull(0)} aria-label="Plein écran" className="absolute top-2 end-2 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-card">
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              {brand?.logo ? <img src={brand.logo} alt={brand.name} className="h-8 w-auto object-contain" /> : product.brand && <p className="text-sm font-bold uppercase">{product.brand}</p>}
              {reference && <p className="text-xs text-text-2">Réf. : <span className="font-medium text-foreground">{reference}</span></p>}
            </div>
            <h1 className="mt-2 text-2xl font-bold leading-tight">{tr(product.name)}</h1>
            {bullets.length > 0 && (
              <>
                <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-text-2">{bullets.map((b) => <li key={b}>{tr(b)}</li>)}</ul>
                <a href="#caracteristiques" className="mt-2 inline-block text-sm font-medium underline">Voir toutes les caractéristiques</a>
              </>
            )}

            <div className="mt-5 border-t border-border pt-4">
              {product.price !== null ? (
                <p className="text-3xl font-bold">{formatDH(product.price)}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl font-bold text-text-2">Prix sur demande</p>
                  <a href={whatsappLinkTo(company.whatsappNumber, priceRequestMessage(product))} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-whatsapp/60 px-4 py-1.5 text-sm font-bold text-whatsapp">
                    <WaIcon className="h-4 w-4" /> Demander le prix
                  </a>
                </div>
              )}
            </div>

            <div ref={buyRef} className="mt-4 flex items-center gap-3">
              <div className="flex items-center rounded-md border border-input">
                <button type="button" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-10 place-items-center"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-sm font-bold">{qty}</span>
                <button type="button" aria-label="Plus" onClick={() => setQty((q) => Math.min(99, q + 1))} className="grid h-11 w-10 place-items-center"><Plus className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={addToCart} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-brand px-6 text-base font-bold text-brand-foreground hover:bg-brand-deep">
                <ShoppingCart className="h-5 w-5" /> Ajouter au panier
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <a href={whatsappLinkTo(company.whatsappNumber, `${productWhatsappMessage(product)} ${pageUrl}`)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-whatsapp px-3 py-3 text-sm font-bold text-background">
                <WaIcon className="h-4 w-4" /> Commander sur WhatsApp
              </a>
              <a href={company.phoneHref} className="inline-flex items-center justify-center gap-2 rounded-md border border-dark px-3 py-3 text-sm font-bold">
                <Phone className="h-4 w-4" /> Appeler
              </a>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <button type="button" onClick={() => toggleFavorite(product.id)} className="inline-flex items-center gap-1.5"><Heart className={cn("h-4 w-4 text-brand", isFav && "fill-brand")} /> {isFav ? "Dans vos favoris" : "Ajouter aux favoris"}</button>
              <button type="button" onClick={() => compare.toggle(product.id)} className="inline-flex items-center gap-1.5"><ArrowLeftRight className="h-4 w-4 text-brand" /> {compare.has(product.id) ? "Dans le comparateur" : "Ajouter au comparateur"}</button>
              <button type="button" onClick={share} className="inline-flex items-center gap-1.5"><Share2 className="h-4 w-4 text-brand" /> Partager</button>
            </div>
            <ul className="mt-4 space-y-2 rounded-md bg-page p-4 text-sm">
              {facts.map(({ Icon, t }) => <li key={t} className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {t}</li>)}
            </ul>
            {admin && product.source_url && (
              <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold underline">
                <ExternalLink className="h-3.5 w-3.5" /> Page officielle (admin)
              </a>
            )}
          </div>
        </div>

        {editing && admin && <ProductLiveEditor product={product} nodes={data.nodes} onClose={() => setEditing(false)} />}

        <div className="sticky top-[var(--header-h,64px)] z-30 mt-4 border-b border-border bg-card">
          <div className="flex gap-1 overflow-x-auto px-2">
            {tabs.map(([id, l]) => (
              <a key={id} href={`#${id}`} className={cn("-mb-px shrink-0 border-b-[3px] px-4 py-3 text-sm font-bold", active === id ? "border-brand" : "border-transparent text-text-2")}>{l}</a>
            ))}
          </div>
        </div>

        {hasDescription && (
          <div id="description" className="panel mt-4 scroll-mt-32 p-5 md:p-8">
            <h2 className="text-xl font-bold">Description</h2>
            {product.characteristics && <p className="mt-3 leading-relaxed whitespace-pre-line text-text-2">{tr(product.characteristics)}</p>}
            {product.marketing_sections.map((m, i) => (
              <div key={i} className="mt-6">
                {"title" in m && m.title && <h3 className="text-lg font-bold">{tr(m.title)}</h3>}
                {"body" in m && m.body && <p className="mt-1 text-text-2">{tr(m.body)}</p>}
                {"image" in m && m.image && <img src={m.image} alt="" loading="lazy" className="mt-3 w-full rounded-md object-contain" />}
                {"images" in m && <div className="mt-3 grid gap-3 sm:grid-cols-3">{m.images.map((src) => <img key={src} src={src} alt="" loading="lazy" className="w-full rounded-md object-contain" />)}</div>}
              </div>
            ))}
          </div>
        )}

        <div id="caracteristiques" className="mt-6 scroll-mt-32">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold">Caractéristiques</h2>
            {sections.length > 1 && (
              <button type="button" onClick={() => setOpenBoxes(allOpen ? new Set() : new Set(sections.map((_, i) => i)))} className="text-sm underline">
                {allOpen ? "Tout fermer" : "Tout ouvrir"}
              </button>
            )}
          </div>
          {sections.length === 0 ? (
            <p className="panel p-6 text-sm text-text-2">Caractéristiques disponibles sur demande.</p>
          ) : (
            <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
              {sections.map((g, i) => (
                <SpecBox key={i} title={g.title} rows={g.rows} open={openBoxes.has(i)}
                  onToggle={() => { const n = new Set(openBoxes); if (n.has(i)) n.delete(i); else n.add(i); setOpenBoxes(n); }} />
              ))}
            </div>
          )}
        </div>

        <div id="livraison" className="panel mt-6 scroll-mt-32 p-5 md:p-8">
          <h2 className="text-xl font-bold">Livraison et retrait</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {facts.map(({ Icon, t }) => <li key={t} className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {t}</li>)}
          </ul>
          <p className="mt-4 text-sm">Une question ? Appelez-nous ou écrivez-nous sur WhatsApp.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <a href={company.phoneHref} className="inline-flex items-center gap-2 rounded-md border border-dark px-4 py-2 text-sm font-bold"><Phone className="h-4 w-4" /> Appeler</a>
            <a href={whatsappLinkTo(company.whatsappNumber, productWhatsappMessage(product))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-whatsapp px-4 py-2 text-sm font-bold text-background"><WaIcon className="h-4 w-4" /> WhatsApp</a>
          </div>
        </div>

        {similar.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Produits similaires</h2>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
              {similar.map((p) => <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[19%]"><ProductCard product={p} /></div>)}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Vous avez vu récemment</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {recent.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </section>

      {showBar && (
        <div id="sticky-buy-bar" className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-border bg-card px-4 py-2.5 md:hidden">
          <p className="min-w-0 flex-1 truncate text-base font-bold">{product.price !== null ? formatDH(product.price) : "Prix sur demande"}</p>
          <a href={whatsappLinkTo(company.whatsappNumber, productWhatsappMessage(product))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-11 w-11 place-items-center rounded-md bg-whatsapp text-background"><WaIcon className="h-5 w-5" /></a>
          <button type="button" onClick={addToCart} className="h-11 rounded-md bg-brand px-4 text-sm font-bold text-brand-foreground">Ajouter au panier</button>
        </div>
      )}

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
          <p className="pb-4 text-center text-sm text-background">{full + 1} / {images.length}</p>
        </div>
      )}
    </SiteLayout>
  );
}
