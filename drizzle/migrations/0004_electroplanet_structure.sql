ALTER TABLE public.catalog_nodes
  ADD COLUMN IF NOT EXISTS show_in_menu boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS menu_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intro_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_text text NOT NULL DEFAULT '';
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS page_color text NOT NULL DEFAULT '#F2F4F5',
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'livraison',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

CREATE TABLE public.catalog_redirects (
  old_path text PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES public.catalog_nodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_redirects TO anon, authenticated;
GRANT ALL ON public.catalog_redirects TO service_role;
ALTER TABLE public.catalog_redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read redirects" ON public.catalog_redirects FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon, authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read visible brands" ON public.brands FOR SELECT TO anon, authenticated USING (visible);

CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Commander en ligne',
  question text NOT NULL,
  answer text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon, authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published faq" ON public.faq_items FOR SELECT TO anon, authenticated USING (published);

CREATE TABLE public.guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  cover_url text NOT NULL DEFAULT '',
  node_id uuid REFERENCES public.catalog_nodes(id) ON DELETE SET NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guides TO anon, authenticated;
GRANT ALL ON public.guides TO service_role;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published guides" ON public.guides FOR SELECT TO anon, authenticated USING (published);

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT 'Autre',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limits_bucket_idx ON public.rate_limits (bucket, created_at);
GRANT ALL ON public.rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limits_id_seq TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;