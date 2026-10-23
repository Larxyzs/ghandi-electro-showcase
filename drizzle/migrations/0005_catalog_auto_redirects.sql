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