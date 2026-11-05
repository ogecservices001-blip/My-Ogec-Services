-- Signalement "Devis à établir" d'où vient le devis, pour un équipement
-- saisi en texte libre dans un BI Dépannage : sans equipement_id, c'est
-- ce qui retire la ligne de la liste une fois le devis créé.
alter table public.devis
  add column signalement_bi text not null default '';
