-- "N°Fi" dans Suivi Devis n'est pas un numéro de facture (malgré son
-- nom) : c'est la référence du Bon d'intervention notée à la main,
-- d'avant que le vrai système de BI existe. Renommé pour ce que c'est
-- réellement — sert à marquer un devis importé comme déjà réalisé
-- (voir /prestations) même sans ligne bons_intervention réelle pour
-- ce travail historique.
alter table public.devis
  rename column numero_facture to bi_reference_historique;

-- Un devis commandé peut ensuite être annulé (client qui se retire) —
-- statut indépendant de date_commande_client, jamais déduit du
-- fichier importé (aucune colonne "Annulé" côté Suivi Devis), toujours
-- posé à la main par le bureau (voir /devis, modale d'édition).
alter table public.devis
  add column annule boolean not null default false;
