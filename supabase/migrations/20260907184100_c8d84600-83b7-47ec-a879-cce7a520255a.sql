CREATE TABLE public.manufacturer_gallery_rules (
  brand TEXT PRIMARY KEY,
  domains TEXT[] NOT NULL DEFAULT '{}',
  identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  gallery JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by TEXT NOT NULL DEFAULT '',
  sample_urls TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.manufacturer_gallery_rules TO service_role;

ALTER TABLE public.manufacturer_gallery_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manufacturer_gallery_rules_service_only" ON public.manufacturer_gallery_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);