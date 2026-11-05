-- Un devis peut porter plusieurs pavés (un par équipement) avec chacun son
-- libellé, sa nature et ses lignes. Les champs historiques (libelle, nature,
-- lignes, equipement_id...) restent remplis par aplatissement des pavés.
alter table public.devis
  add column paves jsonb not null default '[]'::jsonb;
