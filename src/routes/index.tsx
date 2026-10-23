import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import showroom from "@/assets/hero-showroom-2.png.asset.json";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { CatalogTile } from "@/components/CatalogTile";
import { ProductCard } from "@/components/ProductCard";
import { splatOf } from "@/components/HeaderSearch";
import { COMPANY, WHATSAPP_GENERAL_MESSAGE, useCompany, whatsappLinkTo } from "@/lib/company";
import { getGuides } from "@/lib/content.functions";
import { GuideCard } from "@/routes/conseils.index";
import { OpenBadge } from "@/components/SiteLayout";
import { SeoText } from "@/routes/produits.$";
import { useLiveEdit } from "@/lib/live-edit";
import { useDynamicText } from "@/lib/dynamic-text";
import {
  childrenOf,
  nodeHasProducts,
  visibleChildren,
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
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify([
        { "@context": "https://schema.org", "@type": "Organization", name: "Ghandi Home Electro", url: "https://ghandihomeelectro.com", telephone: COMPANY.phone },
        {
          "@context": "https://schema.org", "@type": "ElectronicsStore", name: "Ghandi Home Electro", url: "https://ghandihomeelectro.com", telephone: COMPANY.phone,
          address: { "@type": "PostalAddress", streetAddress: "41 Boulevard Ghandi", addressLocality: "Casablanca", addressCountry: "MA" },
        },
      ]),
    }],
  }),
  loader: () => getGuides().catch(() => []),
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
      className="relative h-full overflow-hidden rounded-lg bg-dark"
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
          <div key={idx} className="relative aspect-[16/9] w-full shrink-0 sm:aspect-[21/9]">
            {s.image && <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/75 via-ink/30 to-transparent" />
            <div className="relative flex h-full max-w-xl flex-col justify-center gap-4 p-6 text-background sm:p-12">
              {s.title && <h2 className="text-xl font-bold sm:text-4xl">{s.title}</h2>}
              {s.button && s.link && (
                <a href={s.link} className="inline-flex w-fit items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">
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
                className={cn("h-2 rounded-full transition-all", idx === i ? "w-6 bg-brand" : "w-2 bg-background/70")} />
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
    <section className="shell py-4">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          {more}
          <button type="button" aria-label="Précédent" onClick={() => scroll(-1)} className="hidden h-8 w-8 place-items-center rounded-full border border-border bg-card sm:grid"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Suivant" onClick={() => scroll(1)} className="hidden h-8 w-8 place-items-center rounded-full border border-border bg-card sm:grid"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:gap-3 [scrollbar-width:none]">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[19%]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RayonsTabs({ data }: { data: SiteData }) {
  const tr = useDynamicText();
  const fams = useMemo(
    () => data.nodes.filter((n) => n.level === 2 && n.show_in_menu !== false && productsIn(data.nodes, data.products, n.id).length >= 4),
    [data.nodes, data.products],
  );
  const [active, setActive] = useState<string | null>(null);
  const cur = fams.find((f) => f.id === active) ?? fams[0];
  if (!cur) return null;
  return (
    <section className="shell py-4">
      <h2 className="mb-3 text-xl font-bold">Nos rayons</h2>
      <div className="panel">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2">
          {fams.map((f) => (
            <button key={f.id} type="button" onClick={() => setActive(f.id)} className={cn("-mb-px shrink-0 border-b-[3px] px-4 py-3 text-sm font-bold", cur.id === f.id ? "border-brand" : "border-transparent text-text-2")}>{tr(f.menu_label?.trim() || f.name)}</button>
          ))}
        </div>
        <div className="-mt-2 px-1 pb-2">
          <Carousel title="" products={productsIn(data.nodes, data.products, cur.id).slice(0, 12)}
            more={<Link to="/produits/$" params={{ _splat: splatOf(data.nodes, cur.id) }} className="text-sm font-bold underline">Voir tout</Link>} />
        </div>
      </div>
    </section>
  );
}

function HomePage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const guides = Route.useLoaderData() ?? [];
  const { admin } = useLiveEdit();
  const company = useCompany();
  const tops = useMemo(() => visibleChildren(data.nodes, data.products, null, Boolean(admin)), [data.nodes, data.products, admin]);
  const featured = useMemo(() => data.products.filter((p) => p.featured), [data.products]);
  const latest = useMemo(() => [...data.products].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 12), [data.products]);
  const shortcuts = (data.settings.content?.shortcuts ?? [])
    .map((id) => data.nodes.find((n) => n.id === id))
    .filter((n): n is CatalogNode => Boolean(n) && (Boolean(admin) || nodeHasProducts(data.nodes, data.products, n!.id)));
  const tiles: CatalogNode[] = [...tops, ...shortcuts.filter((s) => !tops.some((t) => t.id === s.id))];
  const side = (data.settings.content?.secondary_banners ?? []).filter((b) => b.image);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(company.address)}`;
  const seo = data.settings.content?.home_seo_text?.trim();

  return (
    <SiteLayout>
      <div className="shell pt-4">
        <h1 className="sr-only">Ghandi Home Electro — Électroménager et TV à Casablanca</h1>
        <div className={cn("grid gap-3", side.length > 0 && "lg:grid-cols-[2fr_1fr]")}>
          <HeroSlider banners={data.settings.home_banners ?? []} />
          {side.length > 0 && (
            <div className="hidden gap-3 lg:grid">
              {side.slice(0, 2).map((b, i) => (
                <a key={i} href={b.link || "#"} className="relative block overflow-hidden rounded-lg bg-card">
                  <img src={b.image} alt={b.title ?? ""} loading="lazy" className="h-full w-full object-cover" />
                  {b.title && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-3 text-sm font-bold text-background">{b.title}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {tiles.length > 0 && (
        <section className="shell py-4">
          <h2 className="mb-3 text-xl font-bold">Nos univers</h2>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-6">
            {tiles.map((node) => (
              <div key={node.id} className="w-28 shrink-0 snap-start sm:w-auto">
                <CatalogTile node={node} splat={splatOf(data.nodes, node.id)} muted={Boolean(admin) && !nodeHasProducts(data.nodes, data.products, node.id)} />
              </div>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 ? (
        <Carousel title="Modèles en vedette" products={featured} />
      ) : admin ? (
        <section className="shell py-4">
          <p className="rounded-lg border border-dashed border-brand bg-brand-soft p-4 text-sm">
            Modèles en vedette : <Link to="/admin" className="font-bold underline">Choisissez des modèles en vedette</Link> dans l'administration (visible seulement par vous).
          </p>
        </section>
      ) : null}

      {latest.length >= 4 && <Carousel title="Nouveautés" products={latest} />}

      <RayonsTabs data={data} />

      {(data.brands ?? []).length > 0 && (
        <section className="shell py-4">
          <h2 className="mb-3 text-xl font-bold">Nos marques</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {(data.brands ?? []).map((b) => (
              <Link key={b.id} to="/marques/$slug" params={{ slug: b.slug }} className="grid h-16 place-items-center rounded-lg border border-border bg-card p-2 hover:border-input">
                {b.logo ? <img src={b.logo} alt={b.name} loading="lazy" className="max-h-10 w-auto object-contain" /> : <span className="text-sm font-bold">{b.name}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {guides.length > 0 && (
        <section className="shell py-4">
          <div className="mb-3 flex items-end justify-between"><h2 className="text-xl font-bold">Nos conseils</h2><Link to="/conseils" className="text-sm font-bold underline">Tous les conseils</Link></div>
          <div className="grid gap-3 sm:grid-cols-3">{guides.slice(0, 3).map((g) => <GuideCard key={g.id} guide={g} />)}</div>
        </section>
      )}

      <section className="shell grid gap-3 py-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="text-xl font-bold">Notre magasin</h2>
          <div className="mt-2"><OpenBadge /></div>
          <p className="mt-4 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {company.address}</p>
          <div className="mt-3 space-y-1.5 text-sm">
            {company.hours.map((h) => (
              <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span className="font-bold">{h.days}</span> : {h.time}</p>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-brand-foreground"><Navigation className="h-4 w-4" /> Itinéraire</a>
            <a href={company.phoneHref} className="inline-flex items-center gap-2 rounded-md border border-dark px-4 py-2.5 text-sm font-bold"><Phone className="h-4 w-4" /> Appeler</a>
            <a href={whatsappLinkTo(company.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-whatsapp px-4 py-2.5 text-sm font-bold text-background"><WaIcon className="h-4 w-4" /> WhatsApp</a>
          </div>
        </div>
        <iframe title="Plan d'accès" src={company.mapsEmbed} loading="lazy" className="h-72 w-full rounded-lg border border-border lg:h-full" />
      </section>

      {seo && <div className="shell"><SeoText text={seo} /></div>}
    </SiteLayout>
  );
}
