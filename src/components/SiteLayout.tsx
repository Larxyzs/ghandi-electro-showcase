import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Phone, X, MapPin } from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HeaderSearch } from "@/components/HeaderSearch";
import { WhatsAppFloating } from "@/components/WhatsAppFloating";
import { useI18n } from "@/lib/i18n";
import { COMPANY } from "@/lib/company";


function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const items = [
    { to: "/", label: t("nav.home") },
    { to: "/produits", label: t("nav.products") },
    { to: "/a-propos", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeOptions={{ exact: item.to === "/" }}
          activeProps={{ className: "text-brand" }}
          className="relative text-sm font-semibold text-foreground/75 transition-colors hover:text-brand"
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo.url} alt={COMPANY.name} className="h-12 w-12 object-contain" />
            <span className="hidden text-base leading-tight font-semibold sm:block">
              Ghandi
              <span className="block text-[0.7rem] font-medium tracking-[0.22em] text-brand uppercase">
                Home Electro
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <NavLinks />
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <a
              href={COMPANY.phoneHref}
              className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.03] lg:flex"
              style={{ background: "var(--gradient-brand)" }}
            >
              <Phone className="h-4 w-4" />
              {COMPANY.phone}
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/80 md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border bg-background px-5 py-5 md:hidden">
            <nav className="flex flex-col gap-4">
              <NavLinks onNavigate={() => setOpen(false)} />
              <a
                href={COMPANY.phoneHref}
                className="mt-2 flex items-center gap-2 text-sm font-semibold text-brand"
              >
                <Phone className="h-4 w-4" /> {COMPANY.phone}
              </a>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-border bg-brand-soft/60">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo.url} alt="" className="h-11 w-11 object-contain" />
              <span className="font-semibold">{COMPANY.name}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-foreground/65">{t("footer.tagline")}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">
              {t("footer.nav")}
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              <NavLinks />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-[0.16em] text-brand uppercase">
              {t("footer.contact")}
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-foreground/75">
              <a href={COMPANY.phoneHref} className="flex items-center gap-2 hover:text-brand">
                <Phone className="h-4 w-4 text-brand" /> {COMPANY.phone}
              </a>
              <a
                href={COMPANY.mapsHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 hover:text-brand"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {COMPANY.address}
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-border/70 px-5 py-6 text-center text-xs text-foreground/55">
          © {new Date().getFullYear()} {COMPANY.name}. {t("footer.rights")}
        </div>
      </footer>
    </div>
  );
}