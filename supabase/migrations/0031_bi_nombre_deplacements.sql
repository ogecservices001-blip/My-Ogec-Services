-- Nombre de déplacements confirmé juste avant transmission au bureau,
-- par défaut 1 (la plupart des interventions tiennent en un seul
-- passage).
alter table public.bons_intervention
  add column nombre_deplacements integer not null default 1;
