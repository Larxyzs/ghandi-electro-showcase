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