-- Restructure Affaires -> Devis : "Devis" est le cycle de vie complet
-- (créé -> commandé -> ...), "Affaire" n'est qu'un statut dérivé (un
-- devis dont date_commande_client est renseignée) — pas deux entités
-- séparées comme le supposait la table `affaires`. Import désormais
-- mappé sur le classeur "Suivi Devis" (Chrono Devis OGS 2026.xlsm),
-- la vraie origine — le "Client" de l'onglet AFFAIRES du classeur
-- "Base clients" n'est que la référence devis déjà générée ici.
--
-- La table `affaires` (vide, jamais utilisée en prod) sera retirée
-- séparément — voir le message de session pour la marche à suivre.

create table public.devis (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  -- "D-{année}-{item}-{rédacteur}-{n° client}-{n° site}-{nature}",
  -- générée côté classeur, reprise telle quelle.
  numero text not null default '',
  item text not null default '',
  redacteur text not null default '',
  site_id uuid not null references public.sites(id) on delete cascade,
  -- Même échelle de codes que le pôle du Bon d'intervention (voir
  -- src/lib/bi/constants.ts) — "X" ou vide si non renseignée.
  nature text not null default '',
  date_devis text not null default '',
  libelle text not null default '',
  montant numeric,
  -- Vide = devis en attente. Renseignée = devis commandé, autrement
  -- dit une "Affaire" (voir /prestations, à réaliser vs réalisées).
  date_commande_client text not null default '',
  reference_client text not null default '',
  statut_commande_fournisseur text not null default '',
  date_mise_a_disposition_fourniture text not null default '',
  numero_facture text not null default '',
  mois_facturation text not null default '',
  remarques text not null default '',
  debours_materiel_prevu numeric,
  heures_prevues numeric,
  email_responsable_contrat text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devis_site_id_idx on public.devis(site_id);
create index devis_date_commande_client_idx on public.devis(date_commande_client);

create trigger set_updated_at
  before update on public.devis
  for each row execute function public.set_updated_at();

alter table public.devis enable row level security;

create policy "devis_select_staff" on public.devis
  for select using (public.is_staff());
create policy "devis_admin_write" on public.devis
  for all using (public.is_admin()) with check (public.is_admin());

-- Le BI se rattache à un devis (jamais à une "affaire" séparée) — les
-- instantanés suivent le même renommage pour rester cohérents.
alter table public.bons_intervention
  drop column affaire_id,
  drop column affaire_numero_devis,
  drop column affaire_numero_commande_client,
  drop column affaire_date_commande_client,
  add column devis_id uuid references public.devis(id) on delete set null,
  add column devis_numero text not null default '',
  add column devis_reference_client text not null default '',
  add column devis_date_commande_client text not null default '';
