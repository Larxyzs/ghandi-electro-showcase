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