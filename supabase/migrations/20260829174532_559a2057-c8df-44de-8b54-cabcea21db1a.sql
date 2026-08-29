CREATE TABLE public.site_secrets (
  id text PRIMARY KEY DEFAULT 'default',
  search_api_key text,
  ai_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.site_secrets TO service_role;

ALTER TABLE public.site_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_secrets_deny_all" ON public.site_secrets
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER site_secrets_updated_at BEFORE UPDATE ON public.site_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_secrets (id, search_api_key, ai_api_key)
SELECT 'default', search_api_key, ai_api_key FROM public.site_settings WHERE id = 'default'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.site_secrets (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings DROP COLUMN search_api_key, DROP COLUMN ai_api_key;