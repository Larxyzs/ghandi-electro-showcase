import type { SiteContent } from "./catalog-types";

export const DEFAULT_SERVICES: NonNullable<SiteContent["services"]> = [
  { key: "livraison", title: "Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza", text: "Nous livrons gratuitement à Casablanca, Mohammedia et Dar Bouazza. Pour les autres villes, contactez-nous par téléphone.", enabled: true },
  { key: "paiement", title: "Paiement à la livraison", text: "Vous payez à la réception de votre commande.", enabled: true },
  { key: "retrait", title: "Retrait au magasin", text: "Retirez votre commande au 41 Boulevard Ghandi, Casablanca, aux horaires d'ouverture.", enabled: true },
  { key: "conseil", title: "Conseil par téléphone et WhatsApp", text: "Nous vous aidons à choisir l'appareil qui vous convient.", enabled: true },
  { key: "installation", title: "Installation", text: "", enabled: false },
];

export function servicesOf(content?: SiteContent) {
  const saved = content?.services ?? [];
  return DEFAULT_SERVICES.map((d) => ({ ...d, ...(saved.find((s) => s.key === d.key) ?? {}) }));
}
