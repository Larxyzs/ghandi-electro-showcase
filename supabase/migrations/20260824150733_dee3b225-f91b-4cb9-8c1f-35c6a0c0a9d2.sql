ALTER TABLE public.catalog_nodes ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.popular_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.popular_searches TO anon;
GRANT SELECT ON public.popular_searches TO authenticated;
GRANT ALL ON public.popular_searches TO service_role;

ALTER TABLE public.popular_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Popular searches are publicly readable" ON public.popular_searches;
CREATE POLICY "Popular searches are publicly readable"
  ON public.popular_searches FOR SELECT
  TO anon, authenticated
  USING (true);