-- Classement d'un BI une fois vérifié : archivage chantier (rien à
-- facturer) ou à facturer (mois de facturation saisi ensuite, même
-- principe que devis.mois_facturation / statut "Facturable").
alter table public.bons_intervention
  add column classement text not null default '',
  add column mois_facturation text not null default '';
