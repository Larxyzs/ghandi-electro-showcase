import {describe,it,expect} from 'vitest';
import {availabilityOf,availabilityRank,needsPriceConfirmation,searchKey} from '../src/lib/price-stock';
import {validateOrderLine} from '../src/lib/orders-types';
describe('shop price protections',()=>{
  it('matches WBMF 606374 regardless of spaces accents and case',()=>expect(searchKey('WbmF 606374')).toBe(searchKey('wbmf606374')));
  it('ignores accents',()=>expect(searchKey('Réfrigérateur')).toBe(searchKey('refrigerateur')));
  it('requires confirmation below 50 DH',()=>{expect(needsPriceConfirmation(0,49)).toBe(true);expect(needsPriceConfirmation(0,50)).toBe(false);});
  it('requires confirmation above 200000 DH',()=>{expect(needsPriceConfirmation(0,200001)).toBe(true);expect(needsPriceConfirmation(0,200000)).toBe(false);});
  it('requires confirmation only beyond three times the old price',()=>{expect(needsPriceConfirmation(1000,3001)).toBe(true);expect(needsPriceConfirmation(1000,3000)).toBe(false);});
  it('requires confirmation below one third the old price',()=>{expect(needsPriceConfirmation(3000,999)).toBe(true);expect(needsPriceConfirmation(3000,1000)).toBe(false);});
  it('zero price clears price without confirmation',()=>expect(needsPriceConfirmation(4999,0)).toBe(false));
});
describe('availability',()=>{
  it('zero tracked stock becomes out of stock',()=>expect(availabilityOf({stock:0,availability:'in_stock'})).toBe('out_of_stock'));
  it('sur demande remains distinct from rupture',()=>expect(availabilityOf({stock:0,availability:'on_request'})).toBe('on_request'));
  it('sorts stock then request then rupture',()=>expect(['in_stock','on_request','out_of_stock'].map(availability=>availabilityRank({availability,stock:availability==='in_stock'?2:0}))).toEqual([0,1,2]));
  it('refuses on-request checkout',()=>expect(()=>validateOrderLine({id:'p',name:'Produit',price:4999,stock:0,availability:'on_request'},1)).toThrow(/PRODUCT_UNAVAILABLE/));
  it('refuses rupture checkout',()=>expect(()=>validateOrderLine({id:'p',name:'Produit',price:4999,stock:0,availability:'out_of_stock'},1)).toThrow(/PRODUCT_UNAVAILABLE/));
  it('allows two but not three when only two are in stock',()=>{const p={id:'p',name:'Produit',price:4999,stock:2,availability:'in_stock'};expect(validateOrderLine(p,2)).toEqual({qty:2,price:4999});expect(()=>validateOrderLine(p,3)).toThrow(/INSUFFICIENT_STOCK/);});
});