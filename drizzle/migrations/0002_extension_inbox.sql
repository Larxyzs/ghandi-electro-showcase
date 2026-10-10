CREATE TABLE public.extension_batches (
  id text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving','ready','done','cancelled')),
  total_expected integer NOT NULL DEFAULT 0,
  product_count integer NOT NULL DEFAULT 0,
  suggested_category_id uuid,
  suggested_section_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.extension_inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL REFERENCES public.extension_batches(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  payload jsonb NOT NULL,
  suggested_category_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','imported','skipped')),
  product_id uuid,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, source_url)
);
CREATE TABLE public.extension_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.extension_batches, public.extension_inbox_items, public.extension_keys TO service_role;
ALTER TABLE public.extension_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_keys ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER extension_batches_touch BEFORE UPDATE ON public.extension_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();