-- Historique des visites (relevés d'entretien) — miroir de la
-- collection Firestore `releves`. Immuable : un relevé n'est jamais
-- modifié ni supprimé après création (aucune policy update/delete),
-- comme côté Flutter (aucun écran d'édition/suppression).
--
-- informations_internes ne doit JAMAIS être exposé au futur rôle
-- client (voir docs/MIGRATION.md §3) — is_staff() (admin+technicien
-- uniquement) suffit tant que ce rôle n'existe pas encore ; à revoir
-- via une vue/policy dédiée au prompt "comptes/rôle client".

create table public.releves (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  equipement_id uuid not null references public.equipements(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  date timestamptz not null default now(),
  nom_tech text not null default '',
  checklist_values jsonb not null default '{}'::jsonb,
  groupes_mesures jsonb not null default '{}'::jsonb,
  validation_fonctionnement text,
  remarque1 text not null default '',
  remarque2 text not null default '',
  informations_internes text not null default '',
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index releves_equipement_id_date_idx on public.releves(equipement_id, date desc);

alter table public.releves enable row level security;

create policy "releves_select_staff" on public.releves
  for select using (public.is_staff());
create policy "releves_staff_insert" on public.releves
  for insert with check (public.is_staff());
