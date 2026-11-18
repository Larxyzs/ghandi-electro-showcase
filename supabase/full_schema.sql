-- Full database schema of the site (all migrations in order), for a fresh Supabase project.
begin;
-- ===== 20260807185650_974d3750-92df-4f5c-a0b4-d2bbb8505374.sql
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(12,2),
  image_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_id_idx ON public.products(category_id);

CREATE TABLE public.site_settings (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  primary_color TEXT NOT NULL DEFAULT '#ffffff',
  secondary_color TEXT NOT NULL DEFAULT '#1266e8',
  text_color TEXT NOT NULL DEFAULT '#0f172a',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_single_row CHECK (id = 'default')
);

INSERT INTO public.site_settings (id) VALUES ('default');

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Site settings are publicly readable" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ===== 20260808153519_2ecfae17-1759-49a0-9b05-4349e0de9bdf.sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '';

CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_users TO service_role;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "No client select on product images"
ON storage.objects FOR SELECT TO anon, authenticated USING (false);

CREATE POLICY "No client insert on product images"
ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "No client update on product images"
ON storage.objects FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No client delete on product images"
ON storage.objects FOR DELETE TO anon, authenticated USING (false);
-- ===== 20260817153637_4e2b4b77-c1e5-4a9e-88b3-c12259765aa7.sql
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT ALL ON public.admin_users TO service_role;
DROP POLICY IF EXISTS "admin_users_deny_all" ON public.admin_users;
CREATE POLICY "admin_users_deny_all" ON public.admin_users AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
-- ===== 20260819121222_7ec1361f-cb05-48cb-96ad-f7aaf73484df.sql
CREATE TABLE public.catalog_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.catalog_nodes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  level smallint NOT NULL CHECK (level BETWEEN 1 AND 3),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_nodes_root_check CHECK ((level = 1 AND parent_id IS NULL) OR (level > 1 AND parent_id IS NOT NULL))
);

CREATE UNIQUE INDEX catalog_nodes_slug_unique ON public.catalog_nodes (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);
CREATE INDEX catalog_nodes_parent_idx ON public.catalog_nodes (parent_id);

GRANT SELECT ON public.catalog_nodes TO anon;
GRANT SELECT ON public.catalog_nodes TO authenticated;
GRANT ALL ON public.catalog_nodes TO service_role;

ALTER TABLE public.catalog_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalog nodes are publicly readable" ON public.catalog_nodes FOR SELECT USING (true);

CREATE TRIGGER catalog_nodes_set_updated_at BEFORE UPDATE ON public.catalog_nodes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- migrate existing categories into level 1 folders, with Général level 2/3 folders
DO $$
DECLARE c RECORD; l1 uuid; l2 uuid; l3 uuid;
BEGIN
  FOR c IN SELECT * FROM public.categories ORDER BY sort_order, name LOOP
    INSERT INTO public.catalog_nodes (name, slug, level, sort_order) VALUES (c.name, c.slug, 1, c.sort_order) RETURNING id INTO l1;
    INSERT INTO public.catalog_nodes (parent_id, name, slug, level) VALUES (l1, 'Général', 'general', 2) RETURNING id INTO l2;
    INSERT INTO public.catalog_nodes (parent_id, name, slug, level) VALUES (l2, 'Général', 'general', 3) RETURNING id INTO l3;
    UPDATE public.products SET node_id = l3 WHERE false;
  END LOOP;
END $$;

ALTER TABLE public.products ADD COLUMN node_id uuid REFERENCES public.catalog_nodes(id) ON DELETE CASCADE;

DO $$
DECLARE c RECORD; l3 uuid;
BEGIN
  FOR c IN SELECT * FROM public.categories LOOP
    SELECT n3.id INTO l3
    FROM public.catalog_nodes n1
    JOIN public.catalog_nodes n2 ON n2.parent_id = n1.id
    JOIN public.catalog_nodes n3 ON n3.parent_id = n2.id
    WHERE n1.slug = c.slug AND n1.level = 1
    LIMIT 1;
    UPDATE public.products SET node_id = l3 WHERE category_id = c.id;
  END LOOP;
END $$;

ALTER TABLE public.products DROP COLUMN category_id;
ALTER TABLE public.products ALTER COLUMN node_id SET NOT NULL;
DROP TABLE public.categories;
CREATE INDEX products_node_idx ON public.products (node_id);
-- ===== 20260824115859_92723a72-4220-480a-9dde-2d4f061ceb62.sql
ALTER TABLE public.catalog_nodes DROP CONSTRAINT catalog_nodes_level_check;
ALTER TABLE public.catalog_nodes ADD CONSTRAINT catalog_nodes_level_check CHECK (level >= 1 AND level <= 4);
-- ===== 20260824150733_dee3b225-f91b-4cb9-8c1f-35c6a0c0a9d2.sql
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
-- ===== 20260824164156_70af4143-4ae6-46ad-b45f-bf0ba19b872b.sql
ALTER TABLE public.products RENAME COLUMN description TO characteristics;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_name text;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS site_mode text NOT NULL DEFAULT 'online';

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_site_mode_check
  CHECK (site_mode IN ('online', 'maintenance', 'coming_soon', 'closed'));

CREATE TABLE public.cindy_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_username text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  label text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  undone_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.cindy_actions TO service_role;
ALTER TABLE public.cindy_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cindy_actions_deny_all ON public.cindy_actions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.cindy_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_username text NOT NULL,
  title text NOT NULL DEFAULT 'Nouvelle recherche',
  mode text NOT NULL DEFAULT 'auto',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.cindy_sessions TO service_role;
ALTER TABLE public.cindy_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cindy_sessions_deny_all ON public.cindy_sessions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TRIGGER cindy_sessions_updated_at BEFORE UPDATE ON public.cindy_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX cindy_actions_created_idx ON public.cindy_actions (created_at DESC);
CREATE INDEX cindy_sessions_updated_idx ON public.cindy_sessions (updated_at DESC);
-- ===== 20260824170107_db41a3d1-465b-40ee-acee-76de499a8fae.sql
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
-- ===== 20260825143721_bb8a25e8-4e0a-48be-8911-4c8de3010374.sql
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL DEFAULT to_char(now(),'YYMMDD') || lpad((floor(random()*10000))::int::text, 4, '0'),
  full_name text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric,
  status text NOT NULL DEFAULT 'nouveau',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (status IN ('nouveau','en_cours','termine','annule'))
);

GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS orders_touch_updated_at ON public.orders;
CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON public.admin_users (lower(email)) WHERE email IS NOT NULL;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS search_provider text NOT NULL DEFAULT 'tavily';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS search_api_key text;
-- ===== 20260825143748_2ad6bc76-b07d-4af3-88bb-3ce6f65b2f6a.sql
CREATE TABLE IF NOT EXISTS public.admin_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_emails_role_check CHECK (role IN ('super','staff'))
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_emails_email_key ON public.admin_emails (lower(email));
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
-- ===== 20260826164142_c0d42830-2fdd-4116-904e-bfb5c64a04cc.sql
CREATE POLICY orders_deny_all ON public.orders AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY admin_emails_deny_all ON public.admin_emails AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.admin_emails TO service_role;
-- ===== 20260827113538_b5422c41-2811-47e9-a997-29571e144362.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS search_model text NOT NULL DEFAULT 'search';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'gemini';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'gemini-2.5-flash';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_api_key text;
UPDATE public.site_settings SET search_provider = 'serper' WHERE id = 'default' AND (search_api_key IS NULL OR search_api_key = '');
-- ===== 20260827175316_0f9ca94d-dee8-488b-a2de-9e324eea9901.sql
REVOKE SELECT ON public.site_settings FROM anon, authenticated;
GRANT SELECT (id, primary_color, secondary_color, text_color, site_mode, updated_at, search_provider, search_model, ai_provider, ai_model) ON public.site_settings TO anon, authenticated;
-- ===== 20260827181910_52724df9-fb59-417c-ab57-c66fbefd4e59.sql
CREATE TABLE public.site_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL DEFAULT 'Point de restauration',
  created_by text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.site_snapshots TO service_role;

ALTER TABLE public.site_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_snapshots_deny_all" ON public.site_snapshots
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX site_snapshots_created_at_idx ON public.site_snapshots (created_at DESC);
-- ===== 20260828102445_e9f9d9bb-46f7-4093-9435-2db1565a969f.sql
REVOKE SELECT ON public.site_settings FROM anon, authenticated;
GRANT SELECT (id, primary_color, secondary_color, text_color, site_mode, search_provider, search_model, ai_provider, ai_model, updated_at) ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
-- ===== 20260828102518_9caa19aa-255a-4390-b6b8-72f364e75940.sql
GRANT SELECT (id, primary_color, secondary_color, text_color, site_mode, search_provider, search_model, ai_provider, ai_model, updated_at) ON TABLE public.site_settings TO anon;
GRANT SELECT (id, primary_color, secondary_color, text_color, site_mode, search_provider, search_model, ai_provider, ai_model, updated_at) ON TABLE public.site_settings TO authenticated;
-- ===== 20260829013823_42b39896-f6cf-4adb-ab34-0e9af236cc95.sql
CREATE TABLE public.product_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.catalog_nodes(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (product_id, node_id)
);

GRANT SELECT ON public.product_nodes TO anon;
GRANT SELECT ON public.product_nodes TO authenticated;
GRANT ALL ON public.product_nodes TO service_role;

ALTER TABLE public.product_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product category links are publicly readable"
  ON public.product_nodes FOR SELECT USING (true);

CREATE INDEX product_nodes_node_id_idx ON public.product_nodes(node_id);
CREATE INDEX product_nodes_product_id_idx ON public.product_nodes(product_id);

INSERT INTO public.product_nodes (product_id, node_id)
SELECT id, node_id FROM public.products
ON CONFLICT DO NOTHING;
-- ===== 20260829174532_559a2057-c8df-44de-8b54-cabcea21db1a.sql
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
-- ===== 20260901155431_7abfd48b-4307-4a09-8f82-8ed3906c00a7.sql
create table if not exists public.content_translations (
  lang text not null,
  source_hash text not null,
  source text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (lang, source_hash)
);
grant select on public.content_translations to anon, authenticated;
grant all on public.content_translations to service_role;
alter table public.content_translations enable row level security;
drop policy if exists "Translations are public" on public.content_translations;
create policy "Translations are public" on public.content_translations for select to anon, authenticated using (true);
-- ===== 20260905162015_726611ae-cf85-4861-8097-9cdb5818197f.sql
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
-- ===== 20260905162821_9a37508b-536c-4611-b64f-67f0879e7cf3.sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_state TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_payment_state_idx ON public.orders (payment_state);
-- ===== 20260905163116_ec25b440-2228-4b3e-8829-cac68bed58bf.sql
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
-- ===== 20260905171700_30cbf97f-7137-44f9-90a2-1c593b721e38.sql
CREATE TABLE public.catalog_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  official_url text,
  canonical_url text,
  region text NOT NULL DEFAULT 'ma',
  product_type text NOT NULL DEFAULT '',
  node_path text NOT NULL DEFAULT '',
  node_id uuid REFERENCES public.catalog_nodes(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  requires_discovery boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'catalog_snapshot',
  notes text NOT NULL DEFAULT '',
  last_status text NOT NULL DEFAULT 'pending',
  last_error text NOT NULL DEFAULT '',
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.catalog_references TO service_role;
ALTER TABLE public.catalog_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_references_deny_all ON public.catalog_references AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER catalog_references_updated_at BEFORE UPDATE ON public.catalog_references FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX catalog_references_url_key ON public.catalog_references (lower(official_url)) WHERE official_url IS NOT NULL;
CREATE UNIQUE INDEX catalog_references_model_key ON public.catalog_references (lower(brand), lower(model)) WHERE official_url IS NULL;
CREATE INDEX catalog_references_active_idx ON public.catalog_references (active, last_status);

CREATE TABLE public.catalog_rebuild_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'Reconstruction du catalogue',
  created_by text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'running',
  references_preserved integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  verified integer NOT NULL DEFAULT 0,
  needs_review integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  current_label text NOT NULL DEFAULT '',
  delete_products boolean NOT NULL DEFAULT true,
  products_deleted integer NOT NULL DEFAULT 0,
  error text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.catalog_rebuild_jobs TO service_role;
ALTER TABLE public.catalog_rebuild_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_rebuild_jobs_deny_all ON public.catalog_rebuild_jobs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER catalog_rebuild_jobs_updated_at BEFORE UPDATE ON public.catalog_rebuild_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.catalog_rebuild_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.catalog_rebuild_jobs(id) ON DELETE CASCADE,
  reference_id uuid NOT NULL REFERENCES public.catalog_references(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  product_id uuid,
  label text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (job_id, reference_id)
);
GRANT ALL ON public.catalog_rebuild_items TO service_role;
ALTER TABLE public.catalog_rebuild_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_rebuild_items_deny_all ON public.catalog_rebuild_items AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER catalog_rebuild_items_updated_at BEFORE UPDATE ON public.catalog_rebuild_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX catalog_rebuild_items_queue_idx ON public.catalog_rebuild_items (job_id, status, position);

CREATE TABLE public.catalog_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'catalog',
  deep boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'running',
  checked integer NOT NULL DEFAULT 0,
  verified integer NOT NULL DEFAULT 0,
  needs_review integer NOT NULL DEFAULT 0,
  incorrect integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.catalog_audit_runs TO service_role;
ALTER TABLE public.catalog_audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_audit_runs_deny_all ON public.catalog_audit_runs AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER catalog_audit_runs_updated_at BEFORE UPDATE ON public.catalog_audit_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.catalog_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.catalog_audit_runs(id) ON DELETE CASCADE,
  product_id uuid,
  reference_id uuid,
  product_label text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  problem_code text NOT NULL,
  problem text NOT NULL DEFAULT '',
  evidence text NOT NULL DEFAULT '',
  source_url text,
  severity text NOT NULL DEFAULT 'medium',
  action text NOT NULL DEFAULT '',
  auto_repair_safe boolean NOT NULL DEFAULT false,
  repaired_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.catalog_audit_findings TO service_role;
ALTER TABLE public.catalog_audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_audit_findings_deny_all ON public.catalog_audit_findings AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX catalog_audit_findings_run_idx ON public.catalog_audit_findings (run_id, severity);
-- ===== 20260907184100_c8d84600-83b7-47ec-a879-cce7a520255a.sql
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
-- ===== 20261007180509_ceb53f53-4487-4832-96c5-8ec8221249ce.sql
DROP POLICY IF EXISTS "No client delete on product images" ON storage.objects;
DROP POLICY IF EXISTS "No client insert on product images" ON storage.objects;
DROP POLICY IF EXISTS "No client select on product images" ON storage.objects;
DROP POLICY IF EXISTS "No client update on product images" ON storage.objects;
-- ===== 0000_bulk_import_columns.sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS spec_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS products_source_url_unique ON public.products (source_url) WHERE source_url IS NOT NULL AND source_url <> '';
-- ===== 0001_home_banners.sql
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS home_banners jsonb NOT NULL DEFAULT '[]'::jsonb;
-- ===== 0002_extension_inbox.sql
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
-- ===== 0003_unlimited_folder_depth.sql
ALTER TABLE public.catalog_nodes DROP CONSTRAINT catalog_nodes_level_check;
ALTER TABLE public.catalog_nodes ADD CONSTRAINT catalog_nodes_level_check CHECK (level >= 1 AND level <= 1000);
-- ===== 0004_electroplanet_structure.sql
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
-- ===== 0005_catalog_auto_redirects.sql
CREATE OR REPLACE FUNCTION public.catalog_node_path(_id uuid) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id, slug::text AS slug, 0 AS depth FROM catalog_nodes WHERE id = _id
    UNION ALL SELECT n.id, n.parent_id, n.slug, up.depth + 1 FROM catalog_nodes n JOIN up ON n.id = up.parent_id)
  SELECT string_agg(slug, '/' ORDER BY depth DESC) FROM up;
$$;

CREATE OR REPLACE FUNCTION public.catalog_remember_paths() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    INSERT INTO catalog_redirects(old_path, node_id)
    WITH RECURSIVE sub AS (
      SELECT OLD.id AS id, public.catalog_node_path(OLD.id) AS path
      UNION ALL SELECT n.id, sub.path || '/' || n.slug FROM catalog_nodes n JOIN sub ON n.parent_id = sub.id)
    SELECT path, id FROM sub WHERE path IS NOT NULL
    ON CONFLICT (old_path) DO UPDATE SET node_id = excluded.node_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.catalog_remember_paths() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER catalog_nodes_remember_paths BEFORE UPDATE OF slug, parent_id ON public.catalog_nodes
FOR EACH ROW EXECUTE FUNCTION public.catalog_remember_paths();
-- ===== 0006_price_stock_management.sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'out_of_stock' CHECK (availability IN ('in_stock','out_of_stock','on_request')), ADD COLUMN IF NOT EXISTS price_updated_at timestamptz, ADD COLUMN IF NOT EXISTS price_updated_by text, ADD COLUMN IF NOT EXISTS name_edited_by_hand boolean NOT NULL DEFAULT false;
CREATE TABLE public.product_price_backups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), label text NOT NULL, rows jsonb NOT NULL);
GRANT ALL ON public.product_price_backups TO service_role;
ALTER TABLE public.product_price_backups ENABLE ROW LEVEL SECURITY;
INSERT INTO public.product_price_backups(label,rows) SELECT 'Prix avant remise à zéro du 23 octobre 2026',coalesce(jsonb_agg(jsonb_build_object('id',id,'reference',coalesce(nullif(model,''),serial_number),'name',name,'price',price,'stock',stock) ORDER BY id),'[]'::jsonb) FROM public.products;
CREATE TABLE public.product_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, champ text NOT NULL, ancienne_valeur jsonb, nouvelle_valeur jsonb, admin_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), operation_id uuid NOT NULL, reference text NOT NULL DEFAULT '', product_name text NOT NULL DEFAULT '', image_url text, before_state jsonb NOT NULL, after_state jsonb NOT NULL);
GRANT ALL ON public.product_changes TO service_role;
ALTER TABLE public.product_changes ENABLE ROW LEVEL SECURITY;
CREATE INDEX product_changes_recent ON public.product_changes(created_at DESC);
CREATE UNIQUE INDEX product_changes_operation_field ON public.product_changes(operation_id,champ);
CREATE OR REPLACE FUNCTION public.normalize_product_availability() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.availability='in_stock' AND NEW.stock<=0 THEN NEW.availability:='out_of_stock'; END IF;
 IF TG_OP='UPDATE' AND NEW.stock>0 AND NEW.stock IS DISTINCT FROM OLD.stock AND NEW.availability=OLD.availability AND NEW.availability='out_of_stock' THEN NEW.availability:='in_stock'; END IF;
 IF NEW.availability<>'in_stock' THEN NEW.stock:=0; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER products_availability BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.normalize_product_availability();
CREATE OR REPLACE FUNCTION public.save_product_price_stock(_id uuid,_patch jsonb,_expected timestamptz,_email text,_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; old_state jsonb; new_state jsonb; k text; prior jsonb;
BEGIN
 SELECT after_state INTO prior FROM public.product_changes WHERE operation_id=_operation LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('state',prior,'replayed',true); END IF;
 SELECT * INTO p FROM public.products WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
 IF _expected IS DISTINCT FROM p.updated_at THEN RAISE EXCEPTION 'Ce produit a changé. Rechargez-le avant de réessayer.'; END IF;
 old_state:=jsonb_build_object('name',p.name,'price',p.price,'stock',p.stock,'availability',p.availability,'updated_at',p.updated_at);
 UPDATE public.products SET name=CASE WHEN _patch ? 'name' THEN _patch->>'name' ELSE name END, price=CASE WHEN _patch ? 'price' THEN (_patch->>'price')::numeric ELSE price END, stock=CASE WHEN _patch ? 'stock' THEN (_patch->>'stock')::integer ELSE stock END, availability=CASE WHEN _patch ? 'availability' THEN _patch->>'availability' ELSE availability END, name_edited_by_hand=name_edited_by_hand OR (_patch ? 'name' AND (_patch->>'name') IS DISTINCT FROM name), price_updated_at=CASE WHEN _patch ? 'price' AND (_patch->>'price')::numeric IS DISTINCT FROM price THEN now() ELSE price_updated_at END, price_updated_by=CASE WHEN _patch ? 'price' AND (_patch->>'price')::numeric IS DISTINCT FROM price THEN _email ELSE price_updated_by END WHERE id=_id RETURNING * INTO p;
 new_state:=jsonb_build_object('name',p.name,'price',p.price,'stock',p.stock,'availability',p.availability,'updated_at',p.updated_at);
 FOREACH k IN ARRAY ARRAY['name','price','stock','availability'] LOOP
 IF old_state->k IS DISTINCT FROM new_state->k THEN
 INSERT INTO public.product_changes(product_id,champ,ancienne_valeur,nouvelle_valeur,admin_email,operation_id,reference,product_name,image_url,before_state,after_state) VALUES (_id,k,old_state->k,new_state->k,_email,_operation,coalesce(nullif(p.model,''),p.serial_number),p.name,p.image_url,old_state,new_state);
 END IF; END LOOP;
 RETURN jsonb_build_object('state',new_state,'before',old_state);
END $$;
REVOKE ALL ON FUNCTION public.save_product_price_stock(uuid,jsonb,timestamptz,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_product_price_stock(uuid,jsonb,timestamptz,text,uuid) TO service_role;
-- ===== storage bucket for product photos
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict (id) do nothing;
commit;
