-- Pôle Dépannage : remplace le texte libre "Observation technicien" par
-- un état par équipement ("Devis à établir" / "Équipement hors
-- service"), potentiellement plusieurs à la fois. "Équipement
-- opérationnel" ne produit jamais de valeur enregistrée (tableau vide).
alter table public.bons_intervention
  add column etat_equipement jsonb not null default '[]'::jsonb;
