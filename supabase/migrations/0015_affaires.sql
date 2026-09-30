-- Affaires (travaux sur devis) — remplacement, réparation ou
-- installation de matériel confiés par un client en plus de son
-- contrat d'entretien classique. Créées par le bureau (import Excel
-- uniquement, pas de création manuelle — voir Next.js), la nature
-- exacte du travail étant souvent précisée seulement sur le terrain via
-- le Bon d'intervention qui s'y rattachera (Prompt 9b). Miroir de la
-- collection Firestore `affaires`.

create table public.affaires (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  site_id uuid not null references public.sites(id) on delete cascade,
  numero_devis text not null default '',
  designation_prestations text not null default '',
  email_responsable_contrat text not null default '',
  date_commande_client text not null default '',
  numero_commande_client text not null default '',
  -- Code partagé avec le pôle du Bon d'intervention (10/15/20/25/30/35/
  -- 40/50) — vide tant que non précisée.
  nature text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index affaires_site_id_idx on public.affaires(site_id);

alter table public.affaires enable row level security;

create policy "affaires_select_staff" on public.affaires
  for select using (public.is_staff());
create policy "affaires_admin_write" on public.affaires
  for all using (public.is_admin()) with check (public.is_admin());
