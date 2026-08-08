import candy from "@/assets/brands/CANDY.png.asset.json";
import lg from "@/assets/brands/LG.png.asset.json";
import tcl from "@/assets/brands/TCL.png.asset.json";
import samsung from "@/assets/brands/Samsung.png.asset.json";
import whirlpool from "@/assets/brands/Whirlpool.png.asset.json";
import haier from "@/assets/brands/Haier.png.asset.json";
import bosch from "@/assets/brands/Bosch.png.asset.json";

export type Brand = { name: string; logo: string };

export const BRANDS: Brand[] = [
  { name: "Candy", logo: candy.url },
  { name: "LG", logo: lg.url },
  { name: "TCL", logo: tcl.url },
  { name: "Samsung", logo: samsung.url },
  { name: "Whirlpool", logo: whirlpool.url },
  { name: "Haier", logo: haier.url },
  { name: "Bosch", logo: bosch.url },
];

export const BRAND_NAMES = BRANDS.map((b) => b.name);
