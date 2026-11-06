-- Commande fournisseur passée hors taxes (ex : fournisseur en Métropole) :
-- le bon de commande indique "TVA non applicable" au lieu d'une TVA à 0 %.
alter table public.commandes_fournisseur
  add column tva_non_applicable boolean not null default false;
