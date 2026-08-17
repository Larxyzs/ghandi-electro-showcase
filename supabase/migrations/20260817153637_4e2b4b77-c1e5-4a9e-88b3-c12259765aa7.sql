ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;
DROP POLICY IF EXISTS "admin_users_deny_all" ON public.admin_users;
CREATE POLICY "admin_users_deny_all" ON public.admin_users AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);