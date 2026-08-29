export const COMPANY = {
  name: "Ghandi Home Electro",
  founder: "Khaled Douiou",
  phone: "+212 611 945 25",
  phoneHref: "tel:+212611945255",
  address: "41 Boulevard Ghandi, Casablanca-Settat, Maroc",
  mapsHref: "https://maps.google.com/?q=41+Boulevard+Ghandi+Casablanca",
};
/** WhatsApp click-to-chat number: international format, no "+", no spaces. */
export const WHATSAPP_NUMBER = "212661194525";

export const WHATSAPP_GENERAL_MESSAGE =
  "Bonjour j'aimerais parler de votre produits sur votre siteweb Ghandi Home Electro";

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function productWhatsappMessage(product: {
  name: string;
  brand: string;
  price: number | null;
}) {
  const price =
    product.price === null ? "Prix sur demande" : formatMAD(product.price);
  return `Bonjour, j'aimerais parler de votre ${product.name}, ${product.brand}, Prix : ${price}. Merci Beaucoup.`;
}

/** Money as shown across the site: grouped thousands + 2 decimals, e.g. "10 000,00 MAD". */
export function formatMAD(value: number): string {
  return `${value.toLocaleString("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}
