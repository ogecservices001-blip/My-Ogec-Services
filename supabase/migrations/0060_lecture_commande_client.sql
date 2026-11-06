-- Lecture de la commande client : identité de facturation du client sur sa
-- fiche, et montant commandé gardé sur le devis pour signaler un écart.
alter table public.sites
  add column siret text not null default '',
  add column tva_intracom text not null default '',
  add column conditions_paiement text not null default '';

-- La vue fige la liste des colonnes à sa création : il faut la recréer
-- pour qu'elle expose les nouvelles colonnes.
drop view if exists public.sites_view;
create view public.sites_view
  with (security_invoker = true) as
  select *, (n_affaire like '362-%') as hors_contrat from public.sites;

alter table public.devis
  add column montant_commande numeric,
  add column ecart_commande_confirme boolean not null default false;
