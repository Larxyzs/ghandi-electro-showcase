create table if not exists public.content_translations (
  lang text not null,
  source_hash text not null,
  source text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (lang, source_hash)
);
grant select on public.content_translations to anon, authenticated;
grant all on public.content_translations to service_role;
alter table public.content_translations enable row level security;
drop policy if exists "Translations are public" on public.content_translations;
create policy "Translations are public" on public.content_translations for select to anon, authenticated using (true);