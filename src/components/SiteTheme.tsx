import type { SiteSettings } from "@/lib/catalog-types";

export function SiteTheme({ settings }: { settings: SiteSettings }) {
  const css = `:root{--background:${settings.primary_color};--brand:${settings.secondary_color};--ink:${settings.text_color};--foreground:${settings.text_color};--card:${settings.primary_color};--popover:${settings.primary_color};--card-foreground:${settings.text_color};--popover-foreground:${settings.text_color};--primary:${settings.secondary_color};--ring:${settings.secondary_color};--brand-deep:color-mix(in oklab, ${settings.secondary_color} 72%, black);--brand-soft:color-mix(in oklab, ${settings.secondary_color} 10%, white);--gradient-brand:linear-gradient(135deg, color-mix(in oklab, ${settings.secondary_color} 70%, black), ${settings.secondary_color});}`;
  return <style>{css}</style>;
}