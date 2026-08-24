ALTER TABLE public.catalog_nodes DROP CONSTRAINT catalog_nodes_level_check;
ALTER TABLE public.catalog_nodes ADD CONSTRAINT catalog_nodes_level_check CHECK (level >= 1 AND level <= 4);