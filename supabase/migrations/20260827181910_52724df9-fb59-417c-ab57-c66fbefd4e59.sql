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