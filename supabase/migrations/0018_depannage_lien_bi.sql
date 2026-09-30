-- Lien entre une demande de dépannage et le Bon d'intervention créé
-- pour la traiter — permet à l'assistant BI de proposer les
-- dépannages en cours à pré-remplir (voir chargerDepannagesEnCours),
-- et câble enfin les colonnes "N° Bon intervention"/"Commentaires
-- technicien" de l'export Suivi Dépannage (restées vides depuis leur
-- ajout, migration 0008/export route).

alter table public.demandes_depannage
  add column bon_intervention_id uuid references public.bons_intervention(id) on delete set null;
