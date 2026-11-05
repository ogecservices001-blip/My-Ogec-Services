-- Un devis peut couvrir plusieurs équipements (ex : BI Dépannage signalant
-- plusieurs devis à établir). equipement_id reste l'équipement principal,
-- cette colonne porte les suivants.
alter table public.devis
  add column equipements_supplementaires uuid[] not null default '{}';
