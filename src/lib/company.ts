/** Single source of truth for the shop's contact details. */
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
