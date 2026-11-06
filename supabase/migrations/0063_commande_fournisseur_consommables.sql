-- Commande de consommables d'entretien (chiffons, produits...) pour le stock
-- OGEC Services : sans devis, sans client ni équipement. Une commande
-- "affaire" reste obligatoirement rattachée à son devis.
alter table public.commandes_fournisseur
  alter column devis_id drop not null,
  add column type_commande text not null default 'affaire' check (type_commande in ('affaire', 'consommables')),
  add constraint commandes_fournisseur_devis_si_affaire check (type_commande = 'consommables' or devis_id is not null);
