import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLoaderData } from "@tanstack/react-router";
import {
  ArrowUp,
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Facebook,
  Headphones,
  Heart,
  Instagram,
  MapPin,
  Menu,
  Pencil,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  X,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { HeaderSearch, splatOf } from "@/components/HeaderSearch";
import { WhatsAppFloating } from "@/components/WhatsAppFloating";
import { CartDrawer } from "@/components/CartDrawer";
import { CompareTray } from "@/components/CompareTray";
import { nodeIcon } from "@/components/CatalogTile";
import { useCart } from "@/lib/cart";
import { useLiveEdit } from "@/lib/live-edit";
import { useFavorites } from "@/lib/favorites";
import { useCompare } from "@/lib/compare";
import { COMPANY, WHATSAPP_GENERAL_MESSAGE, isOpenNow, useCompany, whatsappLinkTo } from "@/lib/company";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import {
  childrenOf,
  nodeHasProducts,
  productsIn,
  visibleChildren,
  type CatalogNode,
  type SiteData,
} from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";
import { cn } from "@/lib/utils";
import { useBuyBarLift } from "@/lib/use-buybar";

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm5.5 14.5c-.3-.15-1.780-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.15-.15.33-.38.5-.58.13-.15.2-.28.3-.47.1-.2.05-.37-.03-.52-.07-.15-.65-1.6-.9-2.18-.23-.55-.47-.48-.65-.48h-.55c-.2 0-.5.07-.76.37-.26.3-1 1-1 2.42s1.03 2.8 1.180 3c.15.2 2.03 3.22 4.95 4.4 2.42.98 2.9.8 3.43.75.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.25.17-1.37-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}
export { WaIcon };

function useMenu() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const admin = Boolean(useLiveEdit().admin);
  const kids = (id: string | null) => visibleChildren(data.nodes, data.products, id, admin);
  const empty = (n: CatalogNode) => !nodeHasProducts(data.nodes, data.products, n.id);
  const label = (n: CatalogNode) => n.menu_label?.trim() || n.name;
  const shortcuts = (data.settings.content?.shortcuts ?? [])
    .map((id) => data.nodes.find((n) => n.id === id))
    .filter((n): n is CatalogNode => Boolean(n) && (admin || !empty(n!)))
    .slice(0, 3);
  return { data, admin, tops: kids(null), kids, empty, label, shortcuts };
}

function NodeLink({ node, className, onClick, children }: { node: CatalogNode; className?: string; onClick?: () => void; children: ReactNode }) {
  const { data, empty, admin } = useMenu();
  return (
    <Link to="/produits/$" params={{ _splat: splatOf(data.nodes, node.id) }} onClick={onClick}
      className={cn(className, admin && empty(node) && "opacity-50")}>
      {children}
      {admin && empty(node) && <span className="ms-1 text-xs font-normal">(vide)</span>}
    </Link>
  );
}

/* ---------------- Top bar ---------------- */
function TopBar() {
  const company = useCompany();
  return (
    <div className="bg-dark text-xs text-primary-foreground [--primary-foreground:#fff]">
      <div className="shell flex h-9 items-center justify-center gap-4 md:justify-between">
        <p className="truncate text-dark-foreground">
          <span className="hidden md:inline">Livraison partout au Maroc · Paiement à la livraison</span>
          <span className="md:hidden">Paiement à la livraison · Livraison partout au Maroc</span>
        </p>
        <nav className="hidden items-center gap-5 text-dark-foreground md:flex">
          <Link to="/magasin" className="hover:text-brand">Notre magasin</Link>
          <Link to="/suivi-commande" className="hover:text-brand">Suivi de commande</Link>
          <Link to="/besoin-aide" className="hover:text-brand">Besoin d'aide ?</Link>
          <a href={company.phoneHref} className="inline-flex items-center gap-1 font-medium hover:text-brand">
            <Phone className="h-3.5 w-3.5 text-brand" /> {company.phone}
          </a>
        </nav>
      </div>
    </div>
  );
}

/* ---------------- Desktop menus ---------------- */
function useHoverMenu() {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const enter = (id: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(id), 120);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), 200);
  };
  const keep = () => window.clearTimeout(timer.current);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen, enter, leave, keep };
}

function FamilyColumns({ top, onNavigate }: { top: CatalogNode; onNavigate: () => void }) {
  const { kids, label } = useMenu();
  const tr = useDynamicText();
  return (
    <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4">
      {kids(top.id).map((fam) => (
        <div key={fam.id}>
          <NodeLink node={fam} onClick={onNavigate} className="block text-sm font-bold hover:text-brand-deep">{tr(label(fam))}</NodeLink>
          <ul className="mt-2 space-y-1.5">
            {kids(fam.id).map((sub) => (
              <li key={sub.id}>
                <NodeLink node={sub} onClick={onNavigate} className="text-sm text-text-2 hover:text-foreground hover:underline">{tr(label(sub))}</NodeLink>
              </li>
            ))}
          </ul>
          {kids(fam.id).length > 0 && (
            <NodeLink node={fam} onClick={onNavigate} className="mt-2 inline-block text-xs font-medium text-brand-deep hover:underline">Voir tout</NodeLink>
          )}
        </div>
      ))}
    </div>
  );
}

function UniversBar() {
  const { data, tops, label, shortcuts } = useMenu();
  const tr = useDynamicText();
  const m = useHoverMenu();
  const [allHover, setAllHover] = useState<string | null>(null);
  const brands = data.brands ?? [];
  const close = () => m.setOpen(null);

  const brandsIn = (top: CatalogNode) => {
    const names = new Set(productsIn(data.nodes, data.products, top.id).map((p) => p.brand.toLowerCase()));
    return brands.filter((b) => names.has(b.name.toLowerCase()));
  };
  const activeTop = tops.find((t) => t.id === m.open);
  const hoverAll = tops.find((t) => t.id === allHover) ?? tops[0];

  return (
    <nav className="relative hidden border-t border-border bg-card md:block" onMouseLeave={m.leave} aria-label="Rayons">
      <ul className="shell flex items-center gap-1">
        <li>
          <button type="button" onMouseEnter={() => m.enter("__all")} onClick={() => m.setOpen(m.open === "__all" ? null : "__all")}
            aria-expanded={m.open === "__all"}
            className="my-1.5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-brand-foreground">
            <Menu className="h-4 w-4" /> Tous nos rayons
          </button>
        </li>
        {tops.map((top) => (
          <li key={top.id} onMouseEnter={() => m.enter(top.id)}>
            <NodeLink node={top} onClick={close}
              className={cn("flex items-center gap-1 border-b-2 px-3 py-3 text-sm font-medium", m.open === top.id ? "border-brand" : "border-transparent hover:border-brand")}>
              {tr(label(top))}
            </NodeLink>
            <button type="button" className="sr-only focus:not-sr-only" aria-label={`Ouvrir ${top.name}`} onClick={() => m.setOpen(top.id)}>
              <ChevronDown className="h-3 w-3" />
            </button>
          </li>
        ))}
        {shortcuts.map((s) => (
          <li key={s.id} onMouseEnter={m.leave}>
            <NodeLink node={s} className="px-3 py-3 text-sm font-medium text-text-2 hover:text-foreground">{tr(label(s))}</NodeLink>
          </li>
        ))}
        <li onMouseEnter={() => m.enter("__brands")}>
          <button type="button" onClick={() => m.setOpen(m.open === "__brands" ? null : "__brands")} aria-expanded={m.open === "__brands"}
            className="flex items-center gap-1 px-3 py-3 text-sm font-medium">
            Marques <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </li>
      </ul>

      {m.open && (
        <div onMouseEnter={m.keep} className="absolute inset-x-0 top-full z-40 border-t border-border bg-card shadow-[var(--shadow-menu)]">
          <div className="shell py-6">
            {m.open === "__all" && hoverAll && (
              <div className="flex gap-8">
                <ul className="w-60 shrink-0 border-e border-border pe-3">
                  {tops.map((t) => {
                    const Icon = nodeIcon(t.name);
                    return (
                      <li key={t.id} onMouseEnter={() => setAllHover(t.id)}>
                        <NodeLink node={t} onClick={close}
                          className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium", hoverAll.id === t.id && "bg-brand-soft")}>
                          <Icon className="h-5 w-5 text-brand" /> <span className="flex-1">{tr(label(t))}</span> <ChevronRight className="h-4 w-4 text-text-3" />
                        </NodeLink>
                      </li>
                    );
                  })}
                </ul>
                <FamilyColumns top={hoverAll} onNavigate={close} />
              </div>
            )}
            {activeTop && (
              <div className="flex gap-8">
                <FamilyColumns top={activeTop} onNavigate={close} />
                {brandsIn(activeTop).length > 0 && (
                  <div className="w-56 shrink-0 border-s border-border ps-6">
                    <p className="mb-3 text-xs font-bold tracking-wide text-text-3 uppercase">Marques</p>
                    <div className="grid grid-cols-2 gap-2">
                      {brandsIn(activeTop).map((b) => (
                        <Link key={b.id} to="/marques/$slug" params={{ slug: b.slug }} search={{ rayon: splatOf(data.nodes, activeTop.id) }} onClick={close}
                          className="grid h-12 place-items-center rounded-md border border-border bg-card p-1.5 hover:border-input">
                          {b.logo ? <img src={b.logo} alt={b.name} loading="lazy" className="max-h-8 w-auto object-contain" /> : <span className="text-xs font-bold">{b.name}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {m.open === "__brands" && (
              <div>
                <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
                  {brands.map((b) => (
                    <Link key={b.id} to="/marques/$slug" params={{ slug: b.slug }} onClick={close}
                      className="grid h-16 place-items-center rounded-md border border-border bg-card p-2 hover:border-input">
                      {b.logo ? <img src={b.logo} alt={b.name} loading="lazy" className="max-h-10 w-auto object-contain" /> : <span className="font-bold">{b.name}</span>}
                    </Link>
                  ))}
                </div>
                <Link to="/marques" onClick={close} className="mt-4 inline-block text-sm font-medium text-brand-deep hover:underline">Toutes les marques</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ---------------- Phone menu (drill-down) ---------------- */
function MobileMenu({ onClose }: { onClose: () => void }) {
  const { tops, kids, label, admin } = useMenu();
  const company = useCompany();
  const tr = useDynamicText();
  const [stack, setStack] = useState<CatalogNode[]>([]);
  const current = stack.at(-1);
  const list = current ? kids(current.id) : tops;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <aside className="absolute inset-y-0 start-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <img src={logo.url} alt={COMPANY.name} className="h-9 w-9 object-contain" />
          <button type="button" onClick={onClose} aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        {current && (
          <button type="button" onClick={() => setStack(stack.slice(0, -1))} className="flex items-center gap-1 border-b border-border px-4 py-3 text-sm font-medium text-text-2">
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
        )}
        <ul className="divide-y divide-border">
          {current && (
            <li>
              <NodeLink node={current} onClick={onClose} className="block px-4 py-3 text-sm font-bold">Voir tout {tr(label(current))}</NodeLink>
            </li>
          )}
          {list.map((n) => {
            const Icon = nodeIcon(n.name);
            const hasKids = kids(n.id).length > 0;
            return (
              <li key={n.id} className="flex items-center">
                {hasKids ? (
                  <button type="button" onClick={() => setStack([...stack, n])} className="flex flex-1 items-center gap-3 px-4 py-3 text-start text-sm font-medium">
                    {!current && <Icon className="h-5 w-5 text-brand" />} <span className="flex-1">{tr(label(n))}</span> <ChevronRight className="h-4 w-4 text-text-3" />
                  </button>
                ) : (
                  <NodeLink node={n} onClick={onClose} className="flex flex-1 items-center gap-3 px-4 py-3 text-sm font-medium">
                    {!current && <Icon className="h-5 w-5 text-brand" />} {tr(label(n))}
                  </NodeLink>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 space-y-1 border-t-8 border-page px-4 py-4 text-sm">
          <Link to="/marques" onClick={onClose} className="block py-2 font-medium">Marques</Link>
          <Link to="/magasin" onClick={onClose} className="block py-2 font-medium">Notre magasin</Link>
          <Link to="/suivi-commande" onClick={onClose} className="block py-2 font-medium">Suivi de commande</Link>
          <Link to="/besoin-aide" onClick={onClose} className="block py-2 font-medium">Besoin d'aide ?</Link>
          <a href={company.phoneHref} className="flex items-center gap-2 py-2 font-medium"><Phone className="h-4 w-4 text-brand" /> {company.phone}</a>
          <a href={whatsappLinkTo(company.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 font-medium"><WaIcon className="h-4 w-4 text-whatsapp" /> WhatsApp</a>
          {admin && <Link to="/admin" className="flex items-center gap-2 py-2 font-medium"><ShieldCheck className="h-4 w-4" /> Administration</Link>}
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Footer ---------------- */
function OpenBadge() {
  const company = useCompany();
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    const tick = () => setOpen(isOpenNow(company.week));
    tick();
    const t = window.setInterval(tick, 60000);
    return () => window.clearInterval(t);
  }, [company.week]);
  if (open === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold", open ? "bg-whatsapp/20 text-whatsapp" : "bg-destructive/20 text-destructive")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", open ? "bg-whatsapp" : "bg-destructive")} /> {open ? "Ouvert maintenant" : "Fermé"}
    </span>
  );
}
export { OpenBadge };

function Newsletter() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await subscribeNewsletter({ data: { email, source: window.location.pathname } });
      if (r === "ok") { toast.success("Merci, vous êtes inscrit(e)."); setEmail(""); }
      else if (r === "exists") toast.info("Cette adresse est déjà inscrite.");
      else if (r === "limit") toast.error("Trop d'essais. Réessayez plus tard.");
      else toast.error("Adresse email invalide.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-b border-foreground/20 bg-dark">
      <form onSubmit={submit} className="shell flex flex-col items-center gap-3 py-6 md:flex-row md:justify-between">
        <p className="text-base font-bold text-background">Recevez nos nouveautés</p>
        <div className="flex w-full max-w-md gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Votre adresse email" aria-label="Adresse email"
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={busy} className="rounded-md bg-brand px-5 text-sm font-bold text-brand-foreground disabled:opacity-60">S'inscrire</button>
        </div>
      </form>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-foreground/20 py-3 md:border-0 md:py-0" open>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-background md:pointer-events-none">
        {title} <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 md:hidden" />
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-sm text-dark-foreground">{children}</div>
    </details>
  );
}

function Footer() {
  const { data, tops, label } = useMenu();
  const company = useCompany();
  const tr = useDynamicText();
  const pages = data.settings.content?.pages ?? {};
  const social = company.social;
  const socials = [
    { href: social.facebook, Icon: Facebook, label: "Facebook" },
    { href: social.instagram, Icon: Instagram, label: "Instagram" },
    { href: social.youtube, Icon: Youtube, label: "YouTube" },
    { href: social.tiktok, Icon: TikTokIcon, label: "TikTok" },
  ].filter((s) => s.href?.trim());
  const link = "hover:text-background";

  return (
    <footer className="mt-12">
      <div className="border-y border-border bg-card">
        <div className="shell grid grid-cols-2 gap-5 py-6 lg:grid-cols-4">
          {[
            { Icon: Truck, t: "Livraison partout au Maroc", s: "Délai et frais confirmés par téléphone" },
            { Icon: Banknote, t: "Paiement à la livraison", s: "Vous payez à la réception" },
            { Icon: Store, t: "Retrait au magasin", s: company.shortAddress },
            { Icon: Headphones, t: "Conseil par téléphone et WhatsApp", s: "Nous vous aidons à choisir" },
          ].map(({ Icon, t, s }) => (
            <div key={t} className="flex items-start gap-3">
              <Icon className="h-7 w-7 shrink-0 text-brand" strokeWidth={1.6} />
              <div>
                <p className="text-sm font-bold">{t}</p>
                <p className="text-xs text-text-2">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Newsletter />
      <div className="bg-dark">
        <div className="shell grid gap-2 py-8 md:grid-cols-5 md:gap-8">
          <FooterCol title={COMPANY.name}>
            <img src={logo.url} alt="" className="h-11 w-11 rounded bg-card object-contain p-1" />
            <p>Électroménager et TV à Casablanca.</p>
            <a href={company.mapsHref} target="_blank" rel="noreferrer" className={cn("flex items-start gap-2", link)}><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {company.address}</a>
            <a href={company.phoneHref} className={cn("flex items-center gap-2", link)}><Phone className="h-4 w-4 text-brand" /> {company.phone}</a>
            <a href={whatsappLinkTo(company.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2", link)}><WaIcon className="h-4 w-4 text-whatsapp" /> WhatsApp</a>
            {company.hours.map((h) => (
              <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {h.days} : {h.time}</p>
            ))}
            <OpenBadge />
          </FooterCol>
          <FooterCol title="Nos rayons">
            {tops.map((t) => <NodeLink key={t.id} node={t} className={link}>{tr(label(t))}</NodeLink>)}
          </FooterCol>
          <FooterCol title="Marques">
            {(data.brands ?? []).map((b) => <Link key={b.id} to="/marques/$slug" params={{ slug: b.slug }} className={link}>{b.name}</Link>)}
          </FooterCol>
          <FooterCol title="Besoin d'aide ?">
            <Link to="/besoin-aide/faq" className={link}>FAQ</Link>
            <Link to="/besoin-aide/nous-contacter" className={link}>Nous contacter</Link>
            <Link to="/suivi-commande" className={link}>Suivi de commande</Link>
            <Link to="/comment-commander" className={link}>Comment commander</Link>
            <Link to="/livraison" className={link}>Livraison et retrait</Link>
          </FooterCol>
          <FooterCol title="À propos">
            <Link to="/qui-sommes-nous" className={link}>Qui sommes-nous</Link>
            <Link to="/magasin" className={link}>Notre magasin</Link>
            <Link to="/conseils" className={link}>Conseils</Link>
            <Link to="/services" className={link}>Nos services</Link>
            <Link to="/mentions-legales" className={link}>Mentions légales</Link>
            {pages["cgv"]?.body?.trim() && <Link to="/conditions-generales-de-vente" className={link}>Conditions générales de vente</Link>}
            {pages["confidentialite"]?.body?.trim() && <Link to="/politique-de-confidentialite" className={link}>Politique de confidentialité</Link>}
          </FooterCol>
        </div>
        {socials.length > 0 && (
          <div className="shell flex gap-3 pb-6">
            {socials.map(({ href, Icon, label: l }) => (
              <a key={l} href={href} target="_blank" rel="noopener noreferrer" aria-label={l} className="grid h-9 w-9 place-items-center rounded-full border border-foreground/30 text-dark-foreground hover:text-brand">
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}
        <div className="border-t border-foreground/20">
          <p className="shell py-4 text-center text-xs text-dark-foreground">
            © {new Date().getFullYear()} {COMPANY.name} — Tous droits réservés · Paiement à la livraison
          </p>
        </div>
      </div>
    </footer>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.6c.27 0 .53.04.77.12V9.77a5.7 5.7 0 1 0 4.91 5.63V9.01a7.3 7.3 0 0 0 4.27 1.37V7.3a4.27 4.27 0 0 1-3.21-1.48Z" />
    </svg>
  );
}

/* ---------------- Floating ---------------- */

function BackToTop() {
  const [show, setShow] = useState(false);
  const lift = useBuyBarLift();
  useEffect(() => {
    const on = () => setShow(window.scrollY > 600);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  return (
    <button type="button" aria-label="Haut de page" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn("fixed start-4 z-40 grid h-11 w-11 place-items-center rounded-full border border-border bg-card shadow-[var(--shadow-hover)] transition-all", lift ? "bottom-24" : "bottom-5")}>
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

function IconBtn({ label, count, children, ...rest }: { label: string; count?: number; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} {...rest} className="relative flex flex-col items-center gap-0.5 px-2 text-foreground hover:text-brand-deep">
      {children}
      {!!count && <span className="absolute -top-1 end-0 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-brand-foreground">{count > 99 ? "99+" : count}</span>}
      <span className="hidden text-[0.7rem] lg:block">{label}</span>
    </button>
  );
}

/* ---------------- Shell ---------------- */
export function SiteLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const { count } = useCart();
  const favorites = useFavorites();
  const compare = useCompare();
  const { admin, editing, toggle } = useLiveEdit();
  const company = useCompany();

  useEffect(() => {
    const on = () => setCompact(window.scrollY > 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const linkBox = "relative flex flex-col items-center gap-0.5 px-2 text-foreground hover:text-brand-deep";
  const badge = "absolute -top-1 end-0 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-brand-foreground";

  return (
    <div className="flex min-h-screen flex-col bg-page text-foreground">
      <TopBar />
      <header className="sticky top-0 z-40 bg-card shadow-[var(--shadow-card)]">
        <div className={cn("shell grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 transition-all md:gap-8", compact ? "py-2" : "py-3 md:py-4")}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpen(true)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-md border border-border md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo.url} alt={COMPANY.name} className={cn("object-contain transition-all", compact ? "h-9 w-9" : "h-11 w-11")} />
              <span className="hidden text-base leading-tight font-bold lg:block">Ghandi Home Electro</span>
            </Link>
          </div>

          <HeaderSearch className="relative hidden md:block" />

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <Link to="/magasin" className={cn(linkBox, "hidden md:flex")}>
              <MapPin className="h-5 w-5" /> <span className="hidden text-[0.7rem] lg:block">Notre magasin</span>
            </Link>
            <Link to="/favoris" className={linkBox} aria-label="Favoris">
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && <span className={badge}>{favorites.length}</span>}
              <span className="hidden text-[0.7rem] lg:block">Favoris</span>
            </Link>
            {compare.ids.length > 0 && (
              <Link to="/comparateur" className={cn(linkBox, "hidden md:flex")} aria-label="Comparer">
                <ArrowLeftRight className="h-5 w-5" />
                <span className={badge}>{compare.ids.length}</span>
                <span className="hidden text-[0.7rem] lg:block">Comparer</span>
              </Link>
            )}
            <IconBtn label="Panier" count={count} onClick={() => setCartOpen(true)}>
              <ShoppingCart className="h-5 w-5" />
            </IconBtn>
            <a href={whatsappLinkTo(company.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer"
              className="ms-1 hidden items-center gap-1.5 rounded-md bg-whatsapp px-3 py-2 text-sm font-bold text-background xl:inline-flex">
              <WaIcon className="h-4 w-4" /> WhatsApp
            </a>
            {admin && (
              <button type="button" onClick={toggle} title="Éditer le site"
                className={cn("hidden items-center gap-1 rounded-md border px-2.5 py-2 text-xs font-bold sm:inline-flex", editing ? "border-brand bg-brand text-brand-foreground" : "border-border")}>
                <Pencil className="h-3.5 w-3.5" /> {editing ? "ON" : "Éditer"}
              </button>
            )}
            {admin && (
              <Link to="/admin" title="Administration" className="hidden h-9 w-9 place-items-center rounded-md border border-border sm:grid">
                <ShieldCheck className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <HeaderSearch className="relative" />
        </div>
        <UniversBar />
      </header>

      {open && <MobileMenu onClose={() => setOpen(false)} />}

      <main className="flex-1">{children}</main>

      <WhatsAppFloating />
      <BackToTop />
      <CompareTray />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
      <Footer />
    </div>
  );
}

/** Kept for older imports. */
export { childrenOf };
