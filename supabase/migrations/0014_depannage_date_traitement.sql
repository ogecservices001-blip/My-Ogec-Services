-- Date à laquelle un dépannage a été marqué "traitée" — nécessaire
-- pour calculer un délai de traitement (statistiques par client/site/
-- technicien). À réutiliser telle quelle quand le Bon d'intervention
-- sera porté (même notion de délai entre demande et traitement).
alter table public.demandes_depannage
  add column date_traitement timestamptz;
