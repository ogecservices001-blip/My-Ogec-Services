create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  titre text not null,
  detail text not null default '',
  objet_type text not null default '',
  objet_id uuid,
  lien text not null default '',
  created_at timestamptz not null default now(),
  resolu_le timestamptz,
  resolu_par text not null default ''
);

create index if not exists incidents_ouverts_idx on public.incidents (created_at desc) where resolu_le is null;
create index if not exists incidents_objet_idx on public.incidents (objet_id);

alter table public.incidents enable row level security;

drop policy if exists "incidents lecture admin" on public.incidents;
create policy "incidents lecture admin" on public.incidents for select using (public.is_admin());

drop policy if exists "incidents maj admin" on public.incidents;
create policy "incidents maj admin" on public.incidents for update using (public.is_admin()) with check (public.is_admin());
