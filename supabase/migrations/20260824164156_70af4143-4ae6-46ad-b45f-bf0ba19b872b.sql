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