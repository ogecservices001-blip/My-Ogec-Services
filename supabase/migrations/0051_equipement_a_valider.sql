-- Un équipement ajouté directement via GMAO (pas via la validation
-- d'un BI Installation neuve) n'a jamais été vu par le bureau — même
-- logique que les BI "à valider" : il reste marqué tant qu'un admin
-- ne l'a pas confirmé.
alter table public.equipements
  add column a_valider boolean not null default false;
