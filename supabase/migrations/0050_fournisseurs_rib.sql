alter table public.fournisseurs
  add column iban text not null default '',
  add column bic text not null default '';
