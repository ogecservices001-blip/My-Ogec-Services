-- Bon d'intervention (BI) — Prompt 9b. Miroir de la collection
-- Firestore `bis` (lib/features/bon_intervention/data/bi_model.dart).
-- Écriture ouverte à tout le staff (pas admin uniquement) : un
-- technicien doit pouvoir créer/transmettre son propre bon depuis
-- l'assistant, comme côté Flutter (aucune notion de propriétaire
-- appliquée au niveau base, seulement côté UI pour la correction
-- bureau).
--
-- Chrono : réutilise tel quel `prochain_chrono('BI', année)` (voir
-- migration 0012) — même mécanisme que les dépannages, un seul
-- compteur partagé entre tous les pôles.

create table public.bons_intervention (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,

  pole text not null default '',
  chrono integer not null default 0,
  numero text not null default '',
  numero_provisoire boolean not null default false,
  statut text not null default 'brouillon',

  site_id uuid references public.sites(id) on delete set null,
  -- Instantanés — voir demandes_depannage (migration 0008) pour la
  -- même logique : garder l'historique lisible même si le site est
  -- renommé/supprimé plus tard.
  client_nom text not null default '',
  site text not null default '',
  adresse text not null default '',
  email text not null default '',
  hors_contrat boolean not null default false,

  equipement_id uuid references public.equipements(id) on delete set null,
  equipement_nom text not null default '',
  equipement_groupe text not null default '',
  equipement_localisation text not null default '',

  affaire_id uuid references public.affaires(id) on delete set null,
  affaire_numero_devis text not null default '',
  affaire_numero_commande_client text not null default '',
  affaire_date_commande_client text not null default '',

  materiel_type_equipement_id text references public.types_equipement(id),
  materiel_champs_en_tete jsonb not null default '{}'::jsonb,

  entretien_groupes text[] not null default '{}',
  entretien_non_desservis jsonb not null default '[]'::jsonb,

  date_debut text not null default '',
  date_fin text not null default '',
  date_intervention text not null default '',
  temps_passe text not null default '',
  heure_debut text not null default '',
  heure_fin text not null default '',

  techniciens text[] not null default '{}',
  technicien_signataire text not null default '',

  compte_rendu text not null default '',
  obs_tech text not null default '',
  obs_client text not null default '',

  prestas jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,

  sig_tech text not null default '',
  sig_client text not null default '',
  signataire text not null default '',
  signataire_tel_portable text not null default '',
  signataire_tel_fixe text not null default '',
  date_signature text not null default '',

  numero_devis text not null default '',
  note_interne text not null default '',

  -- Prompt 9c (PDF + archivage) — colonnes créées à l'avance, vides
  -- tant que 9c n'est pas fait (même approche que "N° Bon
  -- intervention" resté vide sur l'export dépannage en attendant ce
  -- module).
  drive_bi_folder_id text not null default '',
  pdf_drive_url text not null default '',
  json_drive_url text not null default '',

  history jsonb not null default '[]'::jsonb,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bons_intervention_site_id_idx on public.bons_intervention(site_id);
create index bons_intervention_statut_idx on public.bons_intervention(statut);
create index bons_intervention_updated_at_idx on public.bons_intervention(updated_at desc);

create trigger set_updated_at
  before update on public.bons_intervention
  for each row execute function public.set_updated_at();

alter table public.bons_intervention enable row level security;

create policy "bons_intervention_staff_all" on public.bons_intervention
  for all using (public.is_staff()) with check (public.is_staff());

-- Photos du BI — bucket privé, accessible uniquement au staff via URL
-- signée (jamais public).
insert into storage.buckets (id, name, public)
  values ('bi-photos', 'bi-photos', false)
  on conflict (id) do nothing;

create policy "bi_photos_staff_select" on storage.objects
  for select using (bucket_id = 'bi-photos' and public.is_staff());
create policy "bi_photos_staff_insert" on storage.objects
  for insert with check (bucket_id = 'bi-photos' and public.is_staff());
create policy "bi_photos_staff_delete" on storage.objects
  for delete using (bucket_id = 'bi-photos' and public.is_staff());
