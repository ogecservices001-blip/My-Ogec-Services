-- Bon de commande fournisseur : toujours rattaché à un devis (comme
-- l'ancien classeur "Chrono Commande OGS"), numéro généré à partir des
-- morceaux du n° de devis + initiales fournisseur + compteur propre à
-- ce fournisseur. L'interlocuteur choisi est figé sur la commande
-- (instantané) pour ne pas bouger si le répertoire fournisseur change
-- ensuite.
create table public.commandes_fournisseur (
  id uuid primary key default gen_random_uuid(),
  numero text not null default '',
  devis_id uuid not null references public.devis(id) on delete restrict,
  fournisseur_id uuid not null references public.fournisseurs(id) on delete restrict,
  interlocuteur jsonb not null default '{}',
  chrono_fournisseur integer not null default 0,
  redacteur text not null default '',
  date_commande text not null default '',
  -- [{code, designation, quantite, prix_unitaire}]
  lignes jsonb not null default '[]',
  taux_tva numeric not null default 0,
  devis_fournisseur_numero text not null default '',
  devis_fournisseur_date text not null default '',
  adresse_livraison text not null default '',
  date_livraison_prevue text not null default '',
  -- Port/Incoterm : uniquement pertinents pour un fournisseur Métropole.
  port text not null default '',
  incoterm text not null default '',
  livre boolean not null default false,
  ar_fournisseur text not null default '',
  relance text not null default '',
  observations text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index commandes_fournisseur_numero_key on public.commandes_fournisseur(numero) where numero <> '';
create index commandes_fournisseur_devis_id_idx on public.commandes_fournisseur(devis_id);
create index commandes_fournisseur_fournisseur_id_idx on public.commandes_fournisseur(fournisseur_id);

create trigger set_updated_at
  before update on public.commandes_fournisseur
  for each row execute function public.set_updated_at();

alter table public.commandes_fournisseur enable row level security;

create policy "commandes_fournisseur_select_staff" on public.commandes_fournisseur
  for select using (public.is_staff());
create policy "commandes_fournisseur_admin_write" on public.commandes_fournisseur
  for all using (public.is_admin()) with check (public.is_admin());
