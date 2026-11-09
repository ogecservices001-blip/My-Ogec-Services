-- Une visite d'entretien = un BI "Entretien sous contrat" validé par le
-- bureau, qui saisit à la validation le n° de visite et l'année du contrat
-- ("Visite 2 de 2 — 2026"). Une ligne par équipement entretenu (hors non
-- desservis) : c'est le seul compteur de visites (visite en cours, heures
-- effectuées/restantes). Une visite 2/2 faite en janvier N+1 peut ainsi être
-- rattachée à l'année N.
create table public.visites_entretien (
  id uuid primary key default gen_random_uuid(),
  equipement_id uuid not null references public.equipements(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  bon_intervention_id uuid not null references public.bons_intervention(id) on delete cascade,
  date date not null,
  visite_numero integer not null check (visite_numero between 1 and 12),
  visite_total integer not null check (visite_total between 1 and 12),
  annee integer not null,
  created_at timestamptz not null default now(),
  unique (bon_intervention_id, equipement_id)
);

create index visites_entretien_equipement_annee_idx on public.visites_entretien(equipement_id, annee);
create index visites_entretien_annee_idx on public.visites_entretien(annee);

alter table public.visites_entretien enable row level security;

create policy "visites_entretien_select_staff" on public.visites_entretien
  for select using (public.is_staff());
create policy "visites_entretien_admin_write" on public.visites_entretien
  for all using (public.is_admin()) with check (public.is_admin());

-- Repère de la visite sur le BI lui-même.
alter table public.bons_intervention
  add column visite_numero integer,
  add column visite_total integer,
  add column visite_annee integer;

-- Relevé technique rattaché à la visite à la validation du BI (null tant
-- qu'aucun BI ne l'a rattaché).
alter table public.releves
  add column bon_intervention_id uuid references public.bons_intervention(id) on delete set null,
  add column visite_numero integer,
  add column visite_total integer,
  add column visite_annee integer;

create index releves_bon_intervention_id_idx on public.releves(bon_intervention_id);
