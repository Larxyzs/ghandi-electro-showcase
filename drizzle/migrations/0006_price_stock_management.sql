ALTER TABLE public.products ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'out_of_stock' CHECK (availability IN ('in_stock','out_of_stock','on_request')), ADD COLUMN IF NOT EXISTS price_updated_at timestamptz, ADD COLUMN IF NOT EXISTS price_updated_by text, ADD COLUMN IF NOT EXISTS name_edited_by_hand boolean NOT NULL DEFAULT false;
CREATE TABLE public.product_price_backups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), label text NOT NULL, rows jsonb NOT NULL);
GRANT ALL ON public.product_price_backups TO service_role;
ALTER TABLE public.product_price_backups ENABLE ROW LEVEL SECURITY;
INSERT INTO public.product_price_backups(label,rows) SELECT 'Prix avant remise à zéro du 23 octobre 2026',coalesce(jsonb_agg(jsonb_build_object('id',id,'reference',coalesce(nullif(model,''),serial_number),'name',name,'price',price,'stock',stock) ORDER BY id),'[]'::jsonb) FROM public.products;
CREATE TABLE public.product_changes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, champ text NOT NULL, ancienne_valeur jsonb, nouvelle_valeur jsonb, admin_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), operation_id uuid NOT NULL, reference text NOT NULL DEFAULT '', product_name text NOT NULL DEFAULT '', image_url text, before_state jsonb NOT NULL, after_state jsonb NOT NULL);
GRANT ALL ON public.product_changes TO service_role;
ALTER TABLE public.product_changes ENABLE ROW LEVEL SECURITY;
CREATE INDEX product_changes_recent ON public.product_changes(created_at DESC);
CREATE UNIQUE INDEX product_changes_operation_field ON public.product_changes(operation_id,champ);
CREATE OR REPLACE FUNCTION public.normalize_product_availability() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.availability='in_stock' AND NEW.stock<=0 THEN NEW.availability:='out_of_stock'; END IF;
 IF TG_OP='UPDATE' AND NEW.stock>0 AND NEW.stock IS DISTINCT FROM OLD.stock AND NEW.availability=OLD.availability AND NEW.availability='out_of_stock' THEN NEW.availability:='in_stock'; END IF;
 IF NEW.availability<>'in_stock' THEN NEW.stock:=0; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER products_availability BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.normalize_product_availability();
CREATE OR REPLACE FUNCTION public.save_product_price_stock(_id uuid,_patch jsonb,_expected timestamptz,_email text,_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.products; old_state jsonb; new_state jsonb; k text; prior jsonb;
BEGIN
 SELECT after_state INTO prior FROM public.product_changes WHERE operation_id=_operation LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('state',prior,'replayed',true); END IF;
 SELECT * INTO p FROM public.products WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
 IF _expected IS DISTINCT FROM p.updated_at THEN RAISE EXCEPTION 'Ce produit a changé. Rechargez-le avant de réessayer.'; END IF;
 old_state:=jsonb_build_object('name',p.name,'price',p.price,'stock',p.stock,'availability',p.availability,'updated_at',p.updated_at);
 UPDATE public.products SET name=CASE WHEN _patch ? 'name' THEN _patch->>'name' ELSE name END, price=CASE WHEN _patch ? 'price' THEN (_patch->>'price')::numeric ELSE price END, stock=CASE WHEN _patch ? 'stock' THEN (_patch->>'stock')::integer ELSE stock END, availability=CASE WHEN _patch ? 'availability' THEN _patch->>'availability' ELSE availability END, name_edited_by_hand=name_edited_by_hand OR (_patch ? 'name' AND (_patch->>'name') IS DISTINCT FROM name), price_updated_at=CASE WHEN _patch ? 'price' AND (_patch->>'price')::numeric IS DISTINCT FROM price THEN now() ELSE price_updated_at END, price_updated_by=CASE WHEN _patch ? 'price' AND (_patch->>'price')::numeric IS DISTINCT FROM price THEN _email ELSE price_updated_by END WHERE id=_id RETURNING * INTO p;
 new_state:=jsonb_build_object('name',p.name,'price',p.price,'stock',p.stock,'availability',p.availability,'updated_at',p.updated_at);
 FOREACH k IN ARRAY ARRAY['name','price','stock','availability'] LOOP
 IF old_state->k IS DISTINCT FROM new_state->k THEN
 INSERT INTO public.product_changes(product_id,champ,ancienne_valeur,nouvelle_valeur,admin_email,operation_id,reference,product_name,image_url,before_state,after_state) VALUES (_id,k,old_state->k,new_state->k,_email,_operation,coalesce(nullif(p.model,''),p.serial_number),p.name,p.image_url,old_state,new_state);
 END IF; END LOOP;
 RETURN jsonb_build_object('state',new_state,'before',old_state);
END $$;
REVOKE ALL ON FUNCTION public.save_product_price_stock(uuid,jsonb,timestamptz,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_product_price_stock(uuid,jsonb,timestamptz,text,uuid) TO service_role;