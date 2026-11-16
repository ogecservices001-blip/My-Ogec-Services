alter table public.rh_parametres
  add column jour_arrete smallint not null default 22 check (jour_arrete between 1 and 28);

alter table public.rh_salaries
  add column sans_indemnites boolean not null default false;

update public.rh_salaries set sans_indemnites = true where nom_paie = 'LIXIVEL Elino';

alter table public.rh_clotures
  add column date_arrete date,
  add column etat jsonb;

create table public.rh_etats_preparatoires (
  mois text primary key check (mois ~ '^\d{4}-\d{2}$'),
  date_arrete date,
  observations jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rh_etats_preparatoires enable row level security;
create policy "rh_etats_preparatoires_admin" on public.rh_etats_preparatoires for all using (public.is_admin()) with check (public.is_admin());
