REVOKE SELECT ON public.site_settings FROM anon, authenticated;
GRANT SELECT (id, primary_color, secondary_color, text_color, site_mode, search_provider, search_model, ai_provider, ai_model, updated_at) ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;