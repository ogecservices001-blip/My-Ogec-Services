alter table public.commandes_fournisseur
  add column validite_offre text not null default '',
  add column conditions_paiement text not null default '';
