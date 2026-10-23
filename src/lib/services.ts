import type { SiteContent } from "./catalog-types";

export const DEFAULT_SERVICES: NonNullable<SiteContent["services"]> = [
  { key: "livraison", title: "Livraison partout au Maroc", text: "Nous livrons à Casablanca et partout au Maroc. Le délai et les frais sont confirmés par téléphone.", enabled: true },
  { key: "paiement", title: "Paiement à la livraison", text: "Vous payez à la réception de votre commande.", enabled: true },
  { key: "retrait", title: "Retrait au magasin", text: "Retirez votre commande au 41 Boulevard Ghandi, Casablanca, aux horaires d'ouverture.", enabled: true },
  { key: "conseil", title: "Conseil par téléphone et WhatsApp", text: "Nous vous aidons à choisir l'appareil qui vous convient.", enabled: true },
  { key: "installation", title: "Installation", text: "", enabled: false },
];

export function servicesOf(content?: SiteContent) {
  const saved = content?.services ?? [];
  return DEFAULT_SERVICES.map((d) => ({ ...d, ...(saved.find((s) => s.key === d.key) ?? {}) }));
}
