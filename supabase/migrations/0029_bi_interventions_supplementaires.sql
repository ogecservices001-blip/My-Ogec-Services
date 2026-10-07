-- Pôle Dépannage : un technicien intervient souvent sur plusieurs
-- équipements dans la même visite. Les champs equipement_*/
-- compte_rendu/prestas existants restent la première intervention ;
-- celles ajoutées via "Autre équipement" vont ici.
alter table public.bons_intervention
  add column interventions_supplementaires jsonb not null default '[]'::jsonb;
