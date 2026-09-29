-- Référentiel GMAO : familles d'équipement (types_equipement) et heures
-- de référence (references_horaires), miroir des collections Firestore
-- du même nom.
--
-- types_equipement.id reprend tel quel le slug Firestore existant
-- (mod_roof, mod_split...) — ce n'est pas un identifiant technique
-- généré, mais une clé stable déjà lisible, donc pas de legacy_id ici.
--
-- Pas d'index unique sur (type_equipement1, type_equipement2,
-- type_equipement3) malgré ce qu'on pourrait attendre : les données
-- réelles contiennent 3 combinaisons dupliquées (ex: deux "Terminal Eau
-- Glacée / Plafonnier / 3.5 kw" différenciés uniquement par leur
-- désignation) — c'est un cas géré explicitement côté Flutter dans
-- reference_horaire_tree.dart, pas une anomalie à corriger ici.

create table public.types_equipement (
  id text primary key,
  code text not null default '',
  nom text not null default '',
  champs_en_tete_supplementaires jsonb not null default '[]'::jsonb,
  champs_listes jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  groupes_mesures jsonb not null default '[]'::jsonb,
  type_equipement1_fixe text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.references_horaires (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  designation text not null default '',
  type_equipement1 text not null default '',
  type_equipement2 text not null default '',
  type_equipement3 text not null default '',
  hrs_tech_an numeric not null default 0,
  hrs_assistant_an numeric not null default 0,
  hrs_tech_sem numeric not null default 0,
  hrs_assistant_sem numeric not null default 0,
  hrs_tech_tri numeric not null default 0,
  hrs_assistant_tri numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index references_horaires_types_idx
  on public.references_horaires (type_equipement1, type_equipement2, type_equipement3);

create trigger set_updated_at
  before update on public.types_equipement
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.references_horaires
  for each row execute function public.set_updated_at();

alter table public.types_equipement enable row level security;
alter table public.references_horaires enable row level security;

create policy "types_equipement_select_staff" on public.types_equipement
  for select using (public.is_staff());
create policy "types_equipement_admin_insert" on public.types_equipement
  for insert with check (public.is_admin());
create policy "types_equipement_admin_update" on public.types_equipement
  for update using (public.is_admin());
create policy "types_equipement_admin_delete" on public.types_equipement
  for delete using (public.is_admin());

create policy "references_horaires_select_staff" on public.references_horaires
  for select using (public.is_staff());
create policy "references_horaires_admin_insert" on public.references_horaires
  for insert with check (public.is_admin());
create policy "references_horaires_admin_update" on public.references_horaires
  for update using (public.is_admin());
create policy "references_horaires_admin_delete" on public.references_horaires
  for delete using (public.is_admin());
