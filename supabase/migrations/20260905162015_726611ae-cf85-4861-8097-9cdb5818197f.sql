-- Manufacturer memory: per-domain learned extraction rules and admin corrections
CREATE TABLE public.manufacturer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL DEFAULT '',
  spec_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  gallery_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  page_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  quirks JSONB NOT NULL DEFAULT '[]'::jsonb,
  corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.manufacturer_profiles TO service_role;
ALTER TABLE public.manufacturer_profiles ENABLE ROW LEVEL SECURITY;

-- Import queue / audit trail: one row per official product URL processed
CREATE TABLE public.product_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID,
  url TEXT NOT NULL,
  canonical_url TEXT,
  domain TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'needs_review',
  fetch_method TEXT NOT NULL DEFAULT '',
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL DEFAULT '',
  product_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_imports_url_key ON public.product_imports (url);
CREATE INDEX product_imports_batch_idx ON public.product_imports (batch_id);
CREATE INDEX product_imports_status_idx ON public.product_imports (status);
GRANT ALL ON public.product_imports TO service_role;
ALTER TABLE public.product_imports ENABLE ROW LEVEL SECURITY;

-- Batch progress tracking (resumable, per-product isolation)
CREATE TABLE public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Review state + source evidence on catalog products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS extraction_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TRIGGER manufacturer_profiles_updated_at BEFORE UPDATE ON public.manufacturer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER product_imports_updated_at BEFORE UPDATE ON public.product_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER import_batches_updated_at BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();