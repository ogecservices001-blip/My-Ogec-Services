-- Le lien vers le dépannage d'origine n'était jamais stocké sur le BI
-- lui-même (seulement utilisé une fois, au moment de clôturer le
-- ticket à la transmission "averif") — un brouillon BI créé depuis un
-- dépannage perdait donc ce lien dès qu'on quittait l'assistant,
-- empêchant de le retrouver/reprendre plus tard (voir "Reprendre le
-- BI" sur /depannages).
alter table public.bons_intervention
  add column depannage_id uuid references public.demandes_depannage(id) on delete set null;
