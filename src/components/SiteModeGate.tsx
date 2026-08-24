import { useRouterState } from "@tanstack/react-router";
import { Clock, Hammer, Lock } from "lucide-react";
import logo from "@/assets/ghandi-logo.png.asset.json";
import { COMPANY } from "@/lib/company";
import type { SiteMode } from "@/lib/catalog-types";

const CONTENT: Record<
  Exclude<SiteMode, "online">,
  { icon: typeof Clock; title: string; body: string }
> = {
  maintenance: {
    icon: Hammer,
    title: "Site en maintenance",
    body: "Nous améliorons notre catalogue. Le site sera de nouveau disponible très bientôt.",
  },
  coming_soon: {
    icon: Clock,
    title: "Bientôt disponible",
    body: "Notre nouvelle boutique en ligne arrive très prochainement. Merci de votre patience.",
  },
  closed: {
    icon: Lock,
    title: "Site temporairement fermé",
    body: "Le site est momentanément fermé. Contactez-nous directement, nous restons à votre écoute.",
  },
};

/**
 * Blocks the public site when the admin switches the site out of "online" mode.
 * The /admin area always stays reachable.
 */
export function SiteModeGate({
  mode,
  children,
}: {
  mode: SiteMode;
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (mode === "online" || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return <>{children}</>;
  }

  const { icon: Icon, title, body } = CONTENT[mode];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-soft/30 px-6 text-center">
      <img src={logo.url} alt={COMPANY.name} className="h-20 w-20 object-contain" />
      <span
        className="mt-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-brand)" }}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h1 className="font-display mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-3 max-w-md leading-relaxed text-foreground/65">{body}</p>
      <a
        href={COMPANY.phoneHref}
        className="mt-8 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground"
        style={{ background: "var(--gradient-brand)" }}
      >
        {COMPANY.phone}
      </a>
      <p className="mt-4 text-sm text-foreground/55">{COMPANY.address}</p>
    </main>
  );
}
