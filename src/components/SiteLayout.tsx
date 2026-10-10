import { useState, type ReactNode } from "react";
import { Link, useLoaderData } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Menu,
  Phone,
  X,
  MapPin,
  ShoppingCart,
  ShieldCheck,
  Pencil,
  Truck,
  Banknote,
  Clock,
} from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { HeaderSearch, splatOf } from "@/components/HeaderSearch";
import { WhatsAppFloating } from "@/components/WhatsAppFloating";
import { CartDrawer } from "@/components/CartDrawer";
import { useCart } from "@/lib/cart";
import { useLiveEdit } from "@/lib/live-edit";
import { useFavorites } from "@/lib/favorites";
import { COMPANY, WHATSAPP_GENERAL_MESSAGE, whatsappLink } from "@/lib/company";
import { BRAND_NAMES } from "@/lib/brands";
import { childrenOf, type SiteData } from "@/lib/catalog-types";
import { useDynamicText } from "@/lib/dynamic-text";

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm5.5 14.5c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.15-.15.33-.38.5-.58.13-.15.2-.28.3-.47.1-.2.05-.37-.03-.52-.07-.15-.65-1.6-.9-2.18-.23-.55-.47-.48-.65-.48h-.55c-.2 0-.5.07-.76.37-.26.3-1 1-1 2.42s1.03 2.8 1.18 3c.15.2 2.03 3.22 4.95 4.4 2.42.98 2.9.8 3.43.75.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.25.17-1.37-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}
export { WaIcon };

function useMenu() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const tops = childrenOf(data.nodes, null);
  return { data, tops };
}

function MegaMenu() {
  const { data, tops } = useMenu();
  const tr = useDynamicText();
  return (
    <nav className="hidden border-t border-border bg-card md:block">
      <ul className="mx-auto flex w-full max-w-7xl items-center gap-1 px-5">
        {tops.map((top) => {
          const kids = childrenOf(data.nodes, top.id);
          return (
            <li key={top.id} className="group relative">
              <Link
                to="/produits/$"
                params={{ _splat: top.slug }}
                className="flex items-center gap-1 px-3 py-3 text-sm font-semibold text-foreground/80 hover:text-brand"
              >
                {tr(top.name)} {kids.length > 0 && <ChevronDown className="h-3.5 w-3.5" />}
              </Link>
              {kids.length > 0 && (
                <div className="invisible absolute start-0 top-full z-40 min-w-64 rounded-b-lg border border-border bg-card p-4 opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:visible group-hover:opacity-100">
                  <ul className="grid gap-1">
                    {kids.map((k) => (
                      <li key={k.id}>
                        <Link to="/produits/$" params={{ _splat: splatOf(data.nodes, k.id) }}
                          className="block rounded px-2 py-1.5 text-sm hover:bg-brand-soft hover:text-brand">
                          {tr(k.name)}
                        </Link>
                        {childrenOf(data.nodes, k.id).map((g) => (
                          <Link key={g.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, g.id) }}
                            className="block rounded px-5 py-1 text-xs text-foreground/65 hover:text-brand">
                            {tr(g.name)}
                          </Link>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
        <li className="group relative">
          <span className="flex cursor-default items-center gap-1 px-3 py-3 text-sm font-semibold text-foreground/80">
            Marques <ChevronDown className="h-3.5 w-3.5" />
          </span>
          <div className="invisible absolute start-0 top-full z-40 min-w-48 rounded-b-lg border border-border bg-card p-3 opacity-0 shadow-[var(--shadow-card)] transition-opacity group-hover:visible group-hover:opacity-100">
            {BRAND_NAMES.map((b) => (
              <Link key={b} to="/produits" search={{ q: b }} className="block rounded px-2 py-1.5 text-sm hover:bg-brand-soft hover:text-brand">
                {b}
              </Link>
            ))}
          </div>
        </li>
      </ul>
    </nav>
  );
}

function MobileTree({ onNavigate }: { onNavigate: () => void }) {
  const { data, tops } = useMenu();
  const tr = useDynamicText();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-border">
      {tops.map((top) => {
        const kids = childrenOf(data.nodes, top.id);
        return (
          <li key={top.id}>
            <div className="flex items-center">
              <Link to="/produits/$" params={{ _splat: top.slug }} onClick={onNavigate} className="flex-1 py-3 text-sm font-semibold">
                {tr(top.name)}
              </Link>
              {kids.length > 0 && (
                <button type="button" aria-label="Ouvrir" onClick={() => setOpenId(openId === top.id ? null : top.id)} className="p-3">
                  <ChevronRight className={`h-4 w-4 transition-transform ${openId === top.id ? "rotate-90" : ""}`} />
                </button>
              )}
            </div>
            {openId === top.id && (
              <div className="pb-2 ps-3">
                {kids.map((k) => (
                  <Link key={k.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, k.id) }} onClick={onNavigate}
                    className="block py-2 text-sm text-foreground/75">
                    {tr(k.name)}
                  </Link>
                ))}
              </div>
            )}
          </li>
        );
      })}
      <li className="py-3">
        <p className="text-sm font-semibold">Marques</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BRAND_NAMES.map((b) => (
            <Link key={b} to="/produits" search={{ q: b }} onClick={onNavigate} className="rounded-full border border-border px-3 py-1 text-xs">
              {b}
            </Link>
          ))}
        </div>
      </li>
    </ul>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}

function SiteShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { count } = useCart();
  const favorites = useFavorites();
  const { admin, editing, toggle } = useLiveEdit();
  const { data, tops } = useMenu();
  const tr = useDynamicText();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:gap-6 md:px-5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setOpen(true)} aria-label="Menu" className="grid h-10 w-10 place-items-center rounded-md border border-border md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logo.url} alt={COMPANY.name} className="h-11 w-11 object-contain" />
              <span className="hidden text-base leading-tight font-bold lg:block">
                Ghandi
                <span className="block text-[0.65rem] font-semibold tracking-[0.22em] text-brand uppercase">Home Electro</span>
              </span>
            </Link>
          </div>

          <HeaderSearch className="relative hidden md:block" />

          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <a href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full bg-whatsapp px-4 py-2 text-sm font-semibold text-primary-foreground lg:inline-flex">
              <WaIcon className="h-4 w-4" /> WhatsApp
            </a>
            {admin && (
              <button type="button" onClick={toggle} title="Éditer le site"
                className={`hidden items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold sm:inline-flex ${editing ? "border-brand bg-brand text-primary-foreground" : "border-border"}`}>
                <Pencil className="h-3.5 w-3.5" /> {editing ? "ON" : "Éditer"}
              </button>
            )}
            {admin && (
              <Link to="/admin" title="Administration" className="hidden h-10 w-10 place-items-center rounded-full border border-brand/40 bg-brand-soft text-brand-deep sm:grid">
                <ShieldCheck className="h-4 w-4" />
              </Link>
            )}
            <Link to="/favoris" aria-label="Favoris" className="relative grid h-10 w-10 place-items-center rounded-full border border-border hover:text-brand">
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && (
                <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-primary-foreground">{favorites.length}</span>
              )}
            </Link>
            <button type="button" onClick={() => setCartOpen(true)} aria-label="Panier" className="relative grid h-10 w-10 place-items-center rounded-full border border-border hover:text-brand">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-primary-foreground">{count > 99 ? "99+" : count}</span>
              )}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3 md:hidden">
          <HeaderSearch className="relative" />
        </div>
        <MegaMenu />
      </header>

      {/* Mobile slide-in menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/40" />
          <aside className="absolute inset-y-0 start-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-background p-5 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <img src={logo.url} alt={COMPANY.name} className="h-10 w-10 object-contain" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <MobileTree onNavigate={() => setOpen(false)} />
            <div className="mt-6 space-y-3 text-sm">
              <Link to="/contact" onClick={() => setOpen(false)} className="block font-semibold">Contact</Link>
              <a href={COMPANY.phoneHref} className="flex items-center gap-2 font-semibold text-brand"><Phone className="h-4 w-4" /> {COMPANY.phone}</a>
              {admin && <Link to="/admin" className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Administration</Link>}
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <WhatsAppFloating />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />

      <footer className="mt-20 border-t border-border bg-brand-soft/50">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo.url} alt="" className="h-11 w-11 object-contain" />
              <span className="font-bold">{COMPANY.name}</span>
            </div>
            <p className="mt-3 text-sm text-foreground/65">Électroménager et TV à Casablanca, livraison partout au Maroc.</p>
            <div className="mt-4 space-y-2 text-sm text-foreground/75">
              <a href={COMPANY.mapsHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 hover:text-brand"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {COMPANY.address}</a>
              <a href={COMPANY.phoneHref} className="flex items-center gap-2 hover:text-brand"><Phone className="h-4 w-4 text-brand" /> {COMPANY.phone}</a>
              <a href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-brand"><WaIcon className="h-4 w-4 text-whatsapp" /> WhatsApp</a>
              {COMPANY.hours.map((h) => (
                <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {h.days} : {h.time}</p>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-brand uppercase">Nos rayons</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {tops.map((t) => (
                <Link key={t.id} to="/produits/$" params={{ _splat: splatOf(data.nodes, t.id) }} className="text-foreground/75 hover:text-brand">{tr(t.name)}</Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-brand uppercase">Marques</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {BRAND_NAMES.map((b) => (
                <Link key={b} to="/produits" search={{ q: b }} className="text-foreground/75 hover:text-brand">{b}</Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-brand uppercase">Aide</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link to="/livraison" className="text-foreground/75 hover:text-brand">Livraison</Link>
              <Link to="/contact" className="text-foreground/75 hover:text-brand">Contact</Link>
              <Link to="/a-propos" className="text-foreground/75 hover:text-brand">À propos</Link>
              <Link to="/mentions-legales" className="text-foreground/75 hover:text-brand">Mentions légales</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border/70 px-5 py-5 text-center text-xs text-foreground/55">
          © {new Date().getFullYear()} {COMPANY.name}
        </div>
      </footer>
    </div>
  );
}
