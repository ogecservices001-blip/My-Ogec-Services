-- « Mon contrat OGEC » : espace client. Un contact d'un site (adresse email
-- de la fiche site) y accède une fois activé par le bureau, par un lien de
-- connexion reçu par mail (pas de mot de passe).

create table if not exists public.acces_clients (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  email text not null,
  nom text not null default '',
  active_par text not null default '',
  created_at timestamptz not null default now(),
  invite_le timestamptz,
  derniere_connexion timestamptz,
  revoque_le timestamptz,
  unique (site_id, email)
);
create index if not exists acces_clients_email_idx on public.acces_clients (email);

alter table public.acces_clients enable row level security;
drop policy if exists "acces_clients admin" on public.acces_clients;
create policy "acces_clients admin" on public.acces_clients for all using (public.is_admin()) with check (public.is_admin());

-- Liens de connexion (usage unique, courte durée) et sessions (30 jours).
-- Seul le serveur y accède (clé secrète) : aucune politique.
create table if not exists public.connexions_clients (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('lien', 'session')),
  email text not null,
  jeton_hash text not null unique,
  expire_le timestamptz not null,
  utilise_le timestamptz,
  revoque_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists connexions_clients_email_idx on public.connexions_clients (email, created_at desc);

alter table public.connexions_clients enable row level security;
