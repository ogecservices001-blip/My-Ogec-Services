alter table public.bons_intervention
  add column creneau_id uuid references public.creneaux_planning(id) on delete set null;

create index bons_intervention_creneau_id_idx on public.bons_intervention (creneau_id);
