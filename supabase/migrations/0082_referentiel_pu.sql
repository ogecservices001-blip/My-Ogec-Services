create table public.referentiel_pu (
  id uuid primary key default gen_random_uuid(),
  ordre integer not null default 0,
  famille text not null default '',
  type text not null default '',
  donnee1 text not null default '',
  donnee2 text not null default '',
  donnee3 text not null default '',
  donnee4 text not null default '',
  donnee5 text not null default '',
  donnee6 text not null default '',
  tarif_net_ht numeric(12,2),
  mo_heures numeric(8,2),
  date_maj_tarif date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referentiel_pu_ordre_idx on public.referentiel_pu (ordre);

create trigger set_updated_at
  before update on public.referentiel_pu
  for each row execute function public.set_updated_at();

alter table public.referentiel_pu enable row level security;
create policy "referentiel_pu_admin" on public.referentiel_pu for all using (public.is_admin()) with check (public.is_admin());
