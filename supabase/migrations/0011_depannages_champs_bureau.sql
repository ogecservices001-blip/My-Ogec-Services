-- Complète le portage du classeur "Suivi dépannage.xlsm", qui reste
-- l'outil opérationnel réel du bureau : "Lieu de la panne" et "N°
-- Demande Client" sont des colonnes distinctes du "Motif de l'appel"
-- (déjà `message`), pas fusionnées avec lui.

alter table public.demandes_depannage
  add column lieu_panne text not null default '',
  add column numero_demande_client text not null default '';
