alter table public.creneaux_planning
  add column visite_numero integer,
  add column visite_total integer,
  add column visite_annee integer;

create index creneaux_planning_visite_idx on public.creneaux_planning (site_id, visite_annee, visite_numero);
