import { useLoaderData } from "@tanstack/react-router";
import type { DayHours, SiteContent, SiteData } from "./catalog-types";

/** Single source of truth for the shop's contact details (defaults; admin "Contenu du site" can override). */
export const COMPANY = {
  name: "Ghandi Home Electro",
  founder: "Khaled Douiou",
  phone: "+212 661 194 525",
  phoneHref: "tel:+212661194525",
  address: "41 Boulevard Ghandi, Casablanca-Settat, Maroc",
  shortAddress: "41 Boulevard Ghandi, Casablanca",
  mapsHref: "https://maps.google.com/?q=41+Boulevard+Ghandi+Casablanca",
  mapsEmbed: "https://www.google.com/maps?q=41+Boulevard+Ghandi+Casablanca&output=embed",
  hours: [
    { days: "Lundi – Samedi", time: "9h00 – 13h00 · 15h00 – 20h00" },
    { days: "Dimanche", time: "Fermé" },
  ],
};

/** WhatsApp click-to-chat number: international format, no "+", no spaces. */
export const WHATSAPP_NUMBER = COMPANY.phoneHref.replace(/\D/g, "");

export const WHATSAPP_GENERAL_MESSAGE =
  "Bonjour, j'aimerais avoir des informations sur vos produits (site Ghandi Home Electro).";

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function productWhatsappMessage(product: {
  name: string;
  brand: string;
  price: number | null;
  serial_number?: string;
  model?: string;
}) {
  const ref = product.model || product.serial_number || "";
  const price = product.price === null ? "Prix sur demande" : formatDH(product.price);
  return `Bonjour, je suis intéressé(e) par : ${product.brand} ${product.name}${ref ? ` (réf. ${ref})` : ""}. Prix : ${price}. Merci.`;
}

export function priceRequestMessage(product: { name: string; brand: string; serial_number?: string; model?: string }) {
  const ref = product.model || product.serial_number || "";
  return `Bonjour, pouvez-vous me donner le prix de : ${product.brand} ${product.name}${ref ? ` (réf. ${ref})` : ""} ? Merci.`;
}

/** Money with two decimals, e.g. "10 000,00 MAD". */
export function formatMAD(value: number): string {
  return `${value.toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

/** Shop price display on cards/product page: "4 999,00 DH". */
export function formatDH(value: number): string {
  return `${value.toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DH`;
}

export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Default week: Mon–Sat 9–13 & 15–20, Sunday closed. */
export const DEFAULT_WEEK: DayHours[] = DAY_NAMES.map((_, i) =>
  i === 6 ? { closed: true, ranges: [] } : { closed: false, ranges: [["09:00", "13:00"], ["15:00", "20:00"]] },
);

export type CompanyInfo = typeof COMPANY & {
  week: DayHours[];
  whatsappNumber: string;
  photos: string[];
  social: NonNullable<SiteContent["social"]>;
};

/** Company details merged with admin settings (the only place the UI reads them from). */
export function resolveCompany(content?: SiteContent): CompanyInfo {
  const st = content?.store ?? {};
  const phone = st.phone?.trim() || COMPANY.phone;
  const phoneDigits = phone.replace(/[^\d+]/g, "");
  const address = st.address?.trim() || COMPANY.address;
  const q = encodeURIComponent(address);
  const week = st.week?.length === 7 ? st.week : DEFAULT_WEEK;
  return {
    ...COMPANY,
    phone,
    phoneHref: `tel:${phoneDigits}`,
    address,
    mapsHref: st.maps_link?.trim() || COMPANY.mapsHref,
    mapsEmbed: st.address ? `https://www.google.com/maps?q=${q}&output=embed` : COMPANY.mapsEmbed,
    hours: summarizeWeek(week),
    week,
    whatsappNumber: (st.whatsapp?.trim() || phone).replace(/\D/g, ""),
    photos: st.photos ?? [],
    social: content?.social ?? {},
  };
}

export function useCompany(): CompanyInfo {
  const data = useLoaderData({ from: "__root__" }) as SiteData | undefined;
  return resolveCompany(data?.settings?.content);
}

export function formatDay(d: DayHours) {
  if (d.closed || d.ranges.length === 0) return "Fermé";
  return d.ranges.map(([a, b]) => `${a.replace(":", "h")} – ${b.replace(":", "h")}`).join(" · ");
}

function summarizeWeek(week: DayHours[]) {
  const groups: { days: string; time: string }[] = [];
  let start = 0;
  for (let i = 1; i <= 7; i++) {
    if (i === 7 || formatDay(week[i]!) !== formatDay(week[start]!)) {
      groups.push({
        days: i - 1 === start ? DAY_NAMES[start]! : `${DAY_NAMES[start]} – ${DAY_NAMES[i - 1]}`,
        time: formatDay(week[start]!),
      });
      start = i;
    }
  }
  return groups;
}

/** Casablanca local time (Africa/Casablanca). */
function casablancaNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Casablanca",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayIdx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  return { dayIdx, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function isOpenNow(week: DayHours[], now = new Date()) {
  const { dayIdx, minutes } = casablancaNow(now);
  const d = week[dayIdx];
  if (!d || d.closed) return false;
  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return d.ranges.some(([a, b]) => minutes >= toMin(a) && minutes < toMin(b));
}

export function todayIndex(now = new Date()) {
  return casablancaNow(now).dayIdx;
}

export function whatsappLinkTo(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
