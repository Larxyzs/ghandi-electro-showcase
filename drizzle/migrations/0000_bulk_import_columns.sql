ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS spec_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS products_source_url_unique ON public.products (source_url) WHERE source_url IS NOT NULL AND source_url <> '';