import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  MapPin,
  Phone,
  Store,
  Truck,
} from "lucide-react";
import showroom from "@/assets/hero-showroom-2.png.asset.json";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { CatalogTile } from "@/components/CatalogTile";
import { ProductCard } from "@/components/ProductCard";
import { splatOf } from "@/components/HeaderSearch";
import { COMPANY, WHATSAPP_GENERAL_MESSAGE, whatsappLink } from "@/lib/company";
import { BRANDS } from "@/lib/brands";
import { useLiveEdit } from "@/lib/live-edit";
import { useDynamicText } from "@/lib/dynamic-text";
import {
  childrenOf,
  productsIn,
  type CatalogNode,
  type HomeBanner,
  type Product,
  type SiteData,
} from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ghandi Home Electro | Électroménager et TV à Casablanca" },
      {
        name: "description",
        content:
          "Téléviseurs, réfrigérateurs, lave-linge, climatiseurs et cuisson à Casablanca. Livraison partout au Maroc, paiement à la livraison.",
      },
      { property: "og:title", content: "Ghandi Home Electro | Électroménager et TV à Casablanca" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "Électroménager et TV à Casablanca. Livraison partout au Maroc, paiement à la livraison.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const DEFAULT_BANNERS: HomeBanner[] = [
  { image: showroom.url, title: "Votre magasin d'électroménager à Casablanca", button: "Voir le catalogue", link: "/produits" },
  { image: showroom.url, title: "Froid, lavage, cuisson, TV et climatisation", button: "Découvrir les rayons", link: "/produits" },
  { image: showroom.url, title: "Conseil par téléphone et WhatsApp", button: "Nous contacter", link: "/contact" },
];

function HeroSlider({ banners }: { banners: HomeBanner[] }) {
  const slides = banners.length ? banners : DEFAULT_BANNERS;
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [slides.length]);
  const go = (d: number) => setI((v) => (v + d + slides.length) % slides.length);
  return (
    <div
      className="relative overflow-hidden rounded-lg bg-brand-deep"
      onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0]!.clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${i * 100}%)` }}>
        {slides.map((s, idx) => (
          <div key={idx} className="relative aspect-[16/9] w-full shrink-0 sm:aspect-[21/8]">
            {s.image && <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/30 to-transparent" />
            <div className="relative flex h-full max-w-xl flex-col justify-center gap-4 p-6 text-primary-foreground sm:p-12">
              {s.title && <h2 className="text-xl font-bold sm:text-4xl">{s.title}</h2>}
              {s.button && s.link && (
                <a href={s.link} className="inline-flex w-fit items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold">
                  {s.button} <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button type="button" aria-label="Précédent" onClick={() => go(-1)} className="absolute start-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 sm:grid"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Suivant" onClick={() => go(1)} className="absolute end-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/85 sm:grid"><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {slides.map((_, idx) => (
              <button key={idx} type="button" aria-label={`Diapositive ${idx + 1}`} onClick={() => setI(idx)}
                className={cn("h-2 rounded-full transition-all", idx === i ? "w-6 bg-primary-foreground" : "w-2 bg-primary-foreground/50")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Carousel({ title, products, more }: { title: string; products: Product[]; more?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        <div className="flex items-center gap-2">
          {more}
          <button type="button" aria-label="Précédent" onClick={() => scroll(-1)} className="hidden h-8 w-8 place-items-center rounded-full border border-border sm:grid"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Suivant" onClick={() => scroll(1)} className="hidden h-8 w-8 place-items-center rounded-full border border-border sm:grid"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-3 sm:gap-5 [scrollbar-width:none]">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function HomePage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { admin } = useLiveEdit();
  const tr = useDynamicText();
  const tops = useMemo(() => childrenOf(data.nodes, null), [data.nodes]);
  const featured = useMemo(() => data.products.filter((p) => p.featured), [data.products]);
  const latest = useMemo(
    () => [...data.products].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 12),
    [data.products],
  );
  const findTop = (name: string) => tops.find((n) => n.name.toLowerCase().startsWith(name.toLowerCase()));

  /** Tiles: TV, Réfrigérateurs, Lave-linge, Climatiseurs, Cuisson, Petit électroménager */
  const tileNames = ["Téléviseurs", "Réfrigérateurs", "Lave-linge", "Climatiseurs", "Cuisson", "Petit électroménager"];
  const tiles = tileNames
    .map((name) => data.nodes.find((n) => n.name === name && (n.level === 1 || n.parent_id && tops.some((t) => t.id === n.parent_id))))
    .filter((n): n is CatalogNode => Boolean(n));

  const voirTout = (node: CatalogNode) => (
    <Link to="/produits/$" params={{ _splat: splatOf(data.nodes, node.id) }} className="text-sm font-semibold text-brand hover:underline">Voir tout</Link>
  );

  return (
    <SiteLayout>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-5 sm:pt-6">
        <HeroSlider banners={data.settings.home_banners ?? []} />
      </div>

      {tiles.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-5 py-8">
          <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-6">
            {tiles.map((node) => (
              <div key={node.id} className="w-32 shrink-0 snap-start sm:w-auto">
                <CatalogTile node={node} splat={splatOf(data.nodes, node.id)} count={productsIn(data.nodes, data.products, node.id).length} />
              </div>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 ? (
        <Carousel title="Modèles en vedette" products={featured} />
      ) : admin ? (
        <section className="mx-auto w-full max-w-7xl px-5 py-6">
          <p className="rounded-lg border border-dashed border-brand/40 bg-brand-soft/40 p-5 text-sm">
            Modèles en vedette : <Link to="/admin" className="font-semibold text-brand underline">Choisissez des modèles en vedette</Link> dans l'administration (visible seulement par vous).
          </p>
        </section>
      ) : null}

      {latest.length > 0 && <Carousel title="Nouveautés" products={latest} more={<Link to="/produits" className="text-sm font-semibold text-brand hover:underline">Voir tout</Link>} />}

      {(["Froid", "Lavage", "TV & Son"] as const).map((name) => {
        const node = findTop(name);
        if (!node) return null;
        const list = productsIn(data.nodes, data.products, node.id).slice(0, 12);
        if (list.length === 0) return null;
        return <Carousel key={node.id} title={tr(node.name)} products={list} more={voirTout(node)} />;
      })}

      <section className="mx-auto w-full max-w-7xl px-5 py-10">
        <h2 className="mb-5 text-xl font-bold sm:text-2xl">Nos marques</h2>
        <div className="grid grid-cols-4 items-center gap-4 sm:grid-cols-7">
          {BRANDS.map((b) => (
            <Link key={b.name} to="/produits" search={{ q: b.name }} className="grid h-16 place-items-center rounded-lg border border-border bg-card p-3 hover:border-brand/50">
              <img src={b.logo} alt={b.name} loading="lazy" className="max-h-10 w-auto object-contain" />
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-brand-soft/40">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-6 px-5 py-8 lg:grid-cols-4">
          {[
            { icon: Truck, label: "Livraison rapide" },
            { icon: Banknote, label: "Paiement à la livraison" },
            { icon: Headphones, label: "Conseil par téléphone / WhatsApp" },
            { icon: Store, label: "Magasin à Casablanca" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground"><f.icon className="h-5 w-5" /></span>
              <span className="text-sm font-semibold">{f.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-12 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Notre magasin</h2>
          <p className="mt-4 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {COMPANY.address}</p>
          <div className="mt-4 space-y-1.5 text-sm">
            {COMPANY.hours.map((h) => (
              <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span className="font-semibold">{h.days}</span> : {h.time}</p>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={COMPANY.phoneHref} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground"><Phone className="h-4 w-4" /> Appeler</a>
            <a href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-5 py-2.5 text-sm font-semibold text-primary-foreground"><WaIcon className="h-4 w-4" /> WhatsApp</a>
          </div>
        </div>
        <iframe title="Plan d'accès" src={COMPANY.mapsEmbed} loading="lazy" className="h-72 w-full rounded-lg border border-border lg:h-full" />
      </section>
    </SiteLayout>
  );
}
