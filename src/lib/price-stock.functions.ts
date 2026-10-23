import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const priceStockAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const { priceStockAdmin } = await import('./price-stock.server');
  try { const { email } = await priceStockAdmin(); return { allowed: true, email }; } catch { return { allowed: false, email: '' }; }
});
export const priceStockGoogleLogin = createServerFn({ method: 'POST' }).inputValidator(z.object({ accessToken:z.string().min(1) })).handler(async ({data}) => {
  const { supabaseAdmin:db } = await import('@/integrations/supabase/client.server');
  const { data:user,error } = await db.auth.getUser(data.accessToken);
  const email=user.user?.email;
  if(error || !email) return {ok:false};
  const allowed=await db.from('admin_emails').select('role').ilike('email',email).maybeSingle();
  if(allowed.error || !allowed.data || !['super','staff'].includes(allowed.data.role)) return {ok:false};
  const {loginWithGoogle}=await import('./admin.server');
  return {ok:(await loginWithGoogle(data.accessToken)).ok};
});
export const getPriceStock = createServerFn({ method: 'POST' }).inputValidator(z.object({ q: z.string().max(200).optional(), filter: z.enum(['todo','all','in_stock','out_of_stock','on_request']).optional(), node: z.string().uuid().optional(), brand: z.string().max(150).optional(), offset: z.number().int().min(0).optional() })).handler(async ({ data }) => {
  const { listPriceStock } = await import('./price-stock.server'); return listPriceStock(data);
});
export const updatePriceStock = createServerFn({ method: 'POST' }).inputValidator(z.object({ id: z.string().uuid(), expected: z.string().datetime({ offset: true }), operation: z.string().uuid(), confirmed: z.boolean().optional(), patch: z.object({ name: z.string().max(500).optional(), price: z.number().int().nonnegative().nullable().optional(), stock: z.number().int().nonnegative().max(2147483647).optional(), availability: z.enum(['in_stock','out_of_stock','on_request']).optional() }).strict() })).handler(async ({ data }) => {
  const { savePriceStock } = await import('./price-stock.server'); return savePriceStock(data);
});
export const getPriceStockHistory = createServerFn({ method: 'GET' }).handler(async () => { const { historyPriceStock } = await import('./price-stock.server'); return historyPriceStock(); });
export const revertPriceStock = createServerFn({ method: 'POST' }).inputValidator(z.object({ id: z.string().uuid(), operation: z.string().uuid() })).handler(async ({ data }) => { const { undoPriceStock } = await import('./price-stock.server'); return undoPriceStock(data.id, data.operation); });
export const downloadPriceBackup = createServerFn({ method: 'GET' }).handler(async () => { const { priceBackup } = await import('./price-stock.server'); return priceBackup(); });