create table public.rh_absences_admin (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references public.rh_salaries(id) on delete cascade,
  motif_id uuid not null references public.rh_motifs_absence(id) on delete restrict,
  date_debut date not null,
  date_fin date not null,
  observations text not null default '',
  created_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);

create table public.rh_pointage_ajustements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  vehicule_personnel boolean not null default false,
  observations text not null default '',
  updated_at timestamptz not null default now(),
  primary key (profile_id, date)
);

create table public.rh_clotures (
  mois text primary key check (mois ~ '^\d{4}-\d{2}$'),
  cloture_le timestamptz not null default now(),
  cloture_par text not null default '',
  lignes jsonb not null default '[]'::jsonb
);

alter table public.rh_absences_admin enable row level security;
alter table public.rh_pointage_ajustements enable row level security;
alter table public.rh_clotures enable row level security;
create policy "rh_absences_admin_admin" on public.rh_absences_admin for all using (public.is_admin()) with check (public.is_admin());
create policy "rh_pointage_ajustements_admin" on public.rh_pointage_ajustements for all using (public.is_admin()) with check (public.is_admin());
create policy "rh_clotures_admin" on public.rh_clotures for all using (public.is_admin()) with check (public.is_admin());
