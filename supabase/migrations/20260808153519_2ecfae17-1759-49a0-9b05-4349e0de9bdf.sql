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