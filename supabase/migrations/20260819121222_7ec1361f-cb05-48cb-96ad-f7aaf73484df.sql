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