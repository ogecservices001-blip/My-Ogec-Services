alter table public.devis
  add column if not exists validite_mois integer not null default 1,
  add column if not exists rappel_relance boolean not null default false,
  add column if not exists prochaine_relance date,
  add column if not exists relances jsonb not null default '[]'::jsonb,
  add column if not exists perdu_le date,
  add column if not exists motif_perte text not null default '';

alter table public.devis drop constraint if exists devis_validite_mois_check;
alter table public.devis add constraint devis_validite_mois_check check (validite_mois between 1 and 12);
