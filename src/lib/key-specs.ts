import { normLabel, specSections, type Product } from "./catalog-types";

/** Synonym groups, in display priority. Values come only from the product's own specs. */
const GROUPS: { keys: RegExp; format?: (v: string) => string }[] = [
  { keys: /taille (de l')?ecran|diagonale|ecran \(pouces\)|^taille$/ },
  { keys: /^resolution|definition/ },
  { keys: /volume (total|net|utile)|capacite (totale|nette|utile)|capacite totale/ },
  { keys: /capacite (de )?(lavage|chargement)|charge (maximale|max)|capacite$/ },
  { keys: /essorage|vitesse d'essorage/ },
  { keys: /puissance (frigorifique|de refroidissement)|btu|capacite de refroidissement/ },
  { keys: /no ?frost|total no frost|systeme de (froid|degivrage)|degivrage/ },
  { keys: /inverter|technologie inverter|compresseur/ },
  { keys: /wi-?fi|connectivite/ },
  { keys: /nombre de (feux|bruleurs|foyers)|feux/ },
  { keys: /classe (energetique|d'efficacite)|efficacite energetique/ },
  { keys: /^largeur|largeur \(cm\)/ },
  { keys: /^couleur|coloris/ },
];

/** Short "key specs" list built only from existing spec values (never invented). */
export function keySpecs(product: Product, max: number): string[] {
  const rows = specSections(product).flatMap((s) => s.rows);
  const out: string[] = [];
  const used = new Set<number>();
  for (const g of GROUPS) {
    if (out.length >= max) break;
    const idx = rows.findIndex((r, i) => !used.has(i) && r.value?.trim() && g.keys.test(normLabel(r.label)));
    if (idx < 0) continue;
    used.add(idx);
    const r = rows[idx]!;
    let v = r.value.trim();
    if (/^(oui|yes)$/i.test(v)) v = r.label.trim();
    if (/^(non|no)$/i.test(v)) continue;
    if (v.length > 40) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
