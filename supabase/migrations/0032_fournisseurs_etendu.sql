-- Étend fournisseurs : nouveaux champs (nature fourniture, infos
-- juridiques/administratives) et passage à plusieurs interlocuteurs
-- par fournisseur (nom/tel/portable/email chacun), pour refléter la
-- "Base Fournisseurs" réelle (plusieurs contacts par société).
alter table fournisseurs
  add column nature_fourniture text not null default '',
  add column localisation text not null default '',
  add column raison_sociale_exacte text not null default '',
  add column forme_juridique text not null default '',
  add column siren text not null default '',
  add column siret text not null default '',
  add column tva_intracom text not null default '',
  add column rcs_rm text not null default '',
  add column delai_paiement text not null default '',
  add column mode_reglement text not null default '',
  add column cgv_recues text not null default '',
  add column fiche_maj_le text not null default '',
  add column interlocuteurs_jsonb jsonb not null default '[]';

update fournisseurs
set interlocuteurs_jsonb = case
  when coalesce(interlocuteurs, '') <> '' or coalesce(tel, '') <> '' or coalesce(portable, '') <> '' or coalesce(courriel, '') <> ''
  then jsonb_build_array(jsonb_build_object('nom', interlocuteurs, 'tel', tel, 'portable', portable, 'email', courriel))
  else '[]'::jsonb
end;

alter table fournisseurs drop column interlocuteurs;
alter table fournisseurs drop column tel;
alter table fournisseurs drop column portable;
alter table fournisseurs drop column courriel;
alter table fournisseurs rename column interlocuteurs_jsonb to interlocuteurs;
