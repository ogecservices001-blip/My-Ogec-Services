-- Date du devis, copiée sur le BI à la création comme le sont déjà
-- devis_numero/devis_reference_client/devis_date_commande_client —
-- affichée sur le PDF client (section "DEVIS"), aux côtés des 3 autres.
alter table public.bons_intervention
  add column devis_date_devis text not null default '';
