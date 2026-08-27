ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS search_model text NOT NULL DEFAULT 'search';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'gemini';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'gemini-2.5-flash';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ai_api_key text;
UPDATE public.site_settings SET search_provider = 'serper' WHERE id = 'default' AND (search_api_key IS NULL OR search_api_key = '');