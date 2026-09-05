ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_state TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_payment_state_idx ON public.orders (payment_state);