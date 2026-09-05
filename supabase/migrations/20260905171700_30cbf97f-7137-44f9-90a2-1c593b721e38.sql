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