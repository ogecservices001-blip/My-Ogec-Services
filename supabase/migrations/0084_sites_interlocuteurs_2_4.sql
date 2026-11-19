-- Jusqu'à 4 interlocuteurs par site : le 1er reste interlocuteur_site
-- (contact principal), les 2 à 4 s'ajoutent à côté.
alter table public.sites
  add column interlocuteur_site_2 text not null default '',
  add column tel_fixe_interlocuteur_site_2 text not null default '',
  add column portable_interlocuteur_site_2 text not null default '',
  add column courriel_interlocuteur_site_2 text not null default '',
  add column interlocuteur_site_3 text not null default '',
  add column tel_fixe_interlocuteur_site_3 text not null default '',
  add column portable_interlocuteur_site_3 text not null default '',
  add column courriel_interlocuteur_site_3 text not null default '',
  add column interlocuteur_site_4 text not null default '',
  add column tel_fixe_interlocuteur_site_4 text not null default '',
  add column portable_interlocuteur_site_4 text not null default '',
  add column courriel_interlocuteur_site_4 text not null default '';

drop view if exists public.sites_view;
create view public.sites_view
  with (security_invoker = true) as
  select *, (n_affaire like '362-%') as hors_contrat from public.sites;
