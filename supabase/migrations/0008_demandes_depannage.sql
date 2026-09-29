-- Demandes de dépannage — envoyées depuis la page publique d'un
-- équipement (QR code scanné, email vérifié côté serveur avec la clé
-- secrète Supabase, hors RLS classique : un visiteur anonyme n'a pas
-- de session). Miroir de la collection Firestore `demandes_depannage`.

create type public.statut_depannage as enum ('nouvelle', 'traitee');

create table public.demandes_depannage (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  equipement_id uuid references public.equipements(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  -- Instantanés (nom du client/site/équipement au moment de la demande)
  -- plutôt que de dépendre uniquement des FK, pour garder l'historique
  -- lisible même si l'équipement est renommé ou supprimé plus tard.
  client_nom text not null default '',
  client_site text not null default '',
  equipement_nom text not null default '',
  email text not null default '',
  message text not null default '',
  statut public.statut_depannage not null default 'nouvelle',
  date_creation timestamptz not null default now()
);

create index demandes_depannage_date_idx on public.demandes_depannage(date_creation desc);

alter table public.demandes_depannage enable row level security;

create policy "demandes_depannage_select_staff" on public.demandes_depannage
  for select using (public.is_staff());
create policy "demandes_depannage_staff_update" on public.demandes_depannage
  for update using (public.is_staff());
