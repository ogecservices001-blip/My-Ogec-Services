-- Ajoute le palier "Mensuel" (12 visites/an) aux heures de référence,
-- en plus de Annuelle/Semestrielle/Trimestrielle.
alter table public.references_horaires
  add column hrs_tech_men numeric not null default 0,
  add column hrs_assistant_men numeric not null default 0;
