import { fetchOfficialPage } from "../src/lib/page-fetch.server";
import { resolveProductGallery } from "../src/lib/product-gallery.server";
const url="https://www.whirlpool.ma/ma-fr/produits/refrigerateurs-congelateurs/refrigerateur-congelateur-double-door-freezer-bottom-59-5-cm-wbmf-606404-xna";
const p=await fetchOfficialPage(url);
const g=await resolveProductGallery(p.html,p.finalUrl||url,{brand:"whirlpool"});
console.log(p.method,p.html.length,JSON.stringify(g,null,1));
const m=[...p.html.matchAll(/product-info-image-\d+|data-view-index="\d+"/g)].map(x=>x[0]);
console.log("markers",m.slice(0,20), m.length);
