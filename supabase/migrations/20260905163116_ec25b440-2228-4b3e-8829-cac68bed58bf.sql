-- These three tables are backend-only (written by the import pipeline through the
-- service role, which bypasses RLS). Adding explicit deny-all policies makes the
-- intent visible and silences the "RLS enabled, no policy" linter.
REVOKE ALL ON public.manufacturer_profiles FROM anon, authenticated;
REVOKE ALL ON public.product_imports FROM anon, authenticated;
REVOKE ALL ON public.import_batches FROM anon, authenticated;

GRANT ALL ON public.manufacturer_profiles TO service_role;
GRANT ALL ON public.product_imports TO service_role;
GRANT ALL ON public.import_batches TO service_role;

CREATE POLICY "no client access" ON public.manufacturer_profiles FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.product_imports FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.import_batches FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);