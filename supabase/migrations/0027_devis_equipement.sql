-- Lien optionnel devis → équipement : permet de signaler, sur la fiche
-- de l'équipement et sur le dépannage, qu'un devis le concerne. Les
-- anciens devis restent sans lien (null).
alter table public.devis
  add column equipement_id uuid references public.equipements(id) on delete set null;

create index devis_equipement_id_idx on public.devis(equipement_id);
