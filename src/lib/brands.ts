import candy from "@/assets/brands/CANDY.png.asset.json";
import lg from "@/assets/brands/LG.png.asset.json";
import tcl from "@/assets/brands/TCL.png.asset.json";
import samsung from "@/assets/brands/Samsung.png.asset.json";
import whirlpool from "@/assets/brands/Whirlpool.png.asset.json";
import haier from "@/assets/brands/Haier.png.asset.json";
import bosch from "@/assets/brands/Bosch.png.asset.json";
import franke from "@/assets/brands/Franke.png";

export type Brand = { name: string; logo: string };

export const BRANDS: Brand[] = [
  { name: "Candy", logo: candy.url },
  { name: "LG", logo: lg.url },
  { name: "TCL", logo: tcl.url },
  { name: "Samsung", logo: samsung.url },
  { name: "Whirlpool", logo: whirlpool.url },
  { name: "Haier", logo: haier.url },
  { name: "Bosch", logo: bosch.url },
  { name: "Franke", logo: franke },
];

export const BRAND_NAMES = BRANDS.map((b) => b.name);

/** Bundled logo for a known brand name (used when the admin hasn't uploaded one). */
export function brandLogoFallback(name: string): string | null {
  const key = name.trim().toLowerCase();
  return BRANDS.find((b) => b.name.toLowerCase() === key)?.logo ?? null;
}
