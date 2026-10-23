import type { SiteSettings } from "@/lib/catalog-types";

/** Readable text colour (dark or white) for a given background hex. */
export function contrastText(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#222222";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum > 0.4 ? "#222222" : "#ffffff";
}

export function SiteTheme({ settings }: { settings: SiteSettings }) {
  const accent = settings.secondary_color;
  const page = settings.page_color || "#F2F4F5";
  const css = `:root{--page:${page};--background:${settings.primary_color};--brand:${accent};--brand-foreground:${contrastText(accent)};--ink:${settings.text_color};--foreground:${settings.text_color};--card:${settings.primary_color};--popover:${settings.primary_color};--card-foreground:${settings.text_color};--popover-foreground:${settings.text_color};--primary:${accent};--primary-foreground:${contrastText(accent)};--ring:${accent};--brand-deep:color-mix(in oklab, ${accent} 72%, black);--brand-soft:color-mix(in oklab, ${accent} 14%, white);--gradient-brand:linear-gradient(135deg, color-mix(in oklab, ${accent} 70%, black), ${accent});}`;
  return <style>{css}</style>;
}
