-- Note libre interne (bureau + technicien, jamais visible du client) —
-- distincte de remarque_technicien (journal auto-alimenté par les BI),
-- saisie/modifiée librement à la création ou via l'import "Sommaire".
alter table public.equipements
  add column informations_internes text not null default '';
