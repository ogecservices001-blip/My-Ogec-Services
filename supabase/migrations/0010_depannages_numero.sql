-- Numéro de ticket séquentiel (N° Intervention de la feuille "Chrono
-- Dépannage") — identifiant court à communiquer/rechercher, en plus de
-- l'uuid technique.

create sequence public.demandes_depannage_numero_seq;

alter table public.demandes_depannage
  add column numero integer not null unique default nextval('public.demandes_depannage_numero_seq');

alter sequence public.demandes_depannage_numero_seq owned by public.demandes_depannage.numero;
