-- Parc d'équipements GMAO. Miroir de la collection Firestore
-- `equipements` (lib/features/gmao/equipements/equipement_model.dart).
--
-- code_qr : format court indépendant de Firebase, décidé dans
-- docs/MIGRATION.md §6 (aucune étiquette n'est encore posée sur le
-- terrain — c'est le moment de fixer ce format définitif). Attribué
-- automatiquement par une séquence, y compris pour les équipements déjà
-- existants réimportés depuis Firestore.

create sequence public.equipements_code_qr_seq;

create table public.equipements (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  site_id uuid not null references public.sites(id) on delete cascade,
  type_equipement_id text not null references public.types_equipement(id),
  reference_horaire_id uuid references public.references_horaires(id) on delete set null,
  nom text not null default '',
  numero_equipement text not null default '',
  localisation text not null default '',
  groupe text not null default '',
  champs_en_tete jsonb not null default '{}'::jsonb,
  hors_contrat boolean not null default false,
  remarque_technicien text not null default '',
  code_qr text not null unique
    default ('OGS-' || lpad(nextval('public.equipements_code_qr_seq')::text, 6, '0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.equipements_code_qr_seq owned by public.equipements.code_qr;

create index equipements_site_id_idx on public.equipements(site_id);

create trigger set_updated_at
  before update on public.equipements
  for each row execute function public.set_updated_at();

alter table public.equipements enable row level security;

-- Lecture/écriture ouvertes au personnel (admin + technicien) : un
-- technicien ajoute des équipements sur le terrain (bouton "+" sans
-- restriction côté Flutter) ; seule la suppression reste admin-only,
-- comme dans l'app actuelle.
create policy "equipements_select_staff" on public.equipements
  for select using (public.is_staff());
create policy "equipements_staff_insert" on public.equipements
  for insert with check (public.is_staff());
create policy "equipements_staff_update" on public.equipements
  for update using (public.is_staff());
create policy "equipements_admin_delete" on public.equipements
  for delete using (public.is_admin());
