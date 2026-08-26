CREATE POLICY orders_deny_all ON public.orders AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY admin_emails_deny_all ON public.admin_emails AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.admin_emails TO service_role;