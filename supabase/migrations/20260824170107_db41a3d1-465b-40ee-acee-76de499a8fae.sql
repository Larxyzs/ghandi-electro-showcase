CREATE TABLE public.cindy_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  query text NOT NULL,
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  product jsonb NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  searches_used integer NOT NULL DEFAULT 1,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cindy_cache TO service_role;

ALTER TABLE public.cindy_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY cindy_cache_deny_all ON public.cindy_cache AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER cindy_cache_updated_at BEFORE UPDATE ON public.cindy_cache FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();