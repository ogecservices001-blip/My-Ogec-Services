-- Répertoire : sites clients, fournisseurs, profils utilisateurs (rôle).
-- Miroir des collections Firestore "clients", "suppliers", "users" de
-- l'app Flutter actuelle. Un "site" correspond à un document `clients`
-- Firestore (un client peut avoir plusieurs sites, regroupés côté
-- affichage par le champ `nom`).

create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'technicien', 'en_attente');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'technicien',
  name text not null default '',
  portable text not null default '',
  email_perso text not null default '',
  commune_habitation text not null default '',
  vehicule text not null default '',
  qualite text not null default '',
  created_at timestamptz not null default now()
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  -- Identité & Site
  nom text not null default '',
  site text not null default '',
  n_affaire text not null default '',
  commune text not null default '',
  code_postal text not null default '',
  adresse text not null default '',
  complement_adresse text not null default '',
  -- Accès & Sécurité
  epi_specifique text not null default '',
  habilitation_specifique text not null default '',
  moyen_acces text not null default '',
  jour_acces text not null default '',
  heures_acces text not null default '',
  delai_intervention text not null default '',
  -- Contacts & Suivi
  interlocuteur_site text not null default '',
  tel_fixe_interlocuteur_site text not null default '',
  portable_interlocuteur_site text not null default '',
  courriel_interlocuteur_site text not null default '',
  freq_entretien_an text not null default '',
  interlocuteur_tiers text not null default '',
  tel_fixe_tiers text not null default '',
  portable_tiers text not null default '',
  courriel_tiers text not null default '',
  remarques_libres text not null default '',
  -- Heures & Tarifs (admin)
  nb_heures_vendues text not null default '',
  nb_heures_vendues_assistant text not null default '',
  qte_heures_programmees text not null default '',
  qte_heures_restantes text not null default '',
  taux_horaire_regie text not null default '',
  taux_horaire_vendu text not null default '',
  forfait_deplacement text not null default '',
  -- Contrat (admin)
  date_offre text not null default '',
  date_prise_effet_contrat text not null default '',
  date_fin_contrat text not null default '',
  duree_contrat text not null default '',
  montant_contrat_av text not null default '',
  reference_offre_ogs text not null default '',
  responsable_contrat text not null default '',
  tel_fixe_responsable text not null default '',
  portable_responsable text not null default '',
  courriel_responsable text not null default '',
  -- Facturation (admin)
  adresse_facturation text not null default '',
  code_postal_facturation text not null default '',
  commune_facturation text not null default '',
  complement_adresse_facturation text not null default '',
  interlocuteur_facturation text not null default '',
  tel_fixe_interlocuteur_facturation text not null default '',
  portable_interlocuteur_facturation text not null default '',
  courriel_interlocuteur_facturation text not null default '',
  freq_factu_annuelle text not null default '',
  -- Révision & Indices (admin)
  date_revision text not null default '',
  formule_revision_entretien text not null default '',
  formule_revision_depannage text not null default '',
  date_indice_s text not null default '',
  valeur_indice_s text not null default '',
  date_indice_ch text not null default '',
  valeur_indice_ch text not null default '',
  date_indice_s_prime text not null default '',
  valeur_indice_s_prime text not null default '',
  date_indice_ch_prime text not null default '',
  valeur_indice_ch_prime text not null default '',
  montant_contrat_av_revise text not null default '',
  taux_horaire_revise text not null default '',
  forfait_deplacement_revise text not null default '',
  modif_ri_ou_bg text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Hors contrat" se déduit de n_affaire (préfixe "362-"), même règle que
-- ClientModel.horsContrat côté Flutter — jamais un champ saisi à part.
create or replace view public.sites_view as
  select *, (n_affaire like '362-%') as hors_contrat from public.sites;

create table public.fournisseurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null default '',
  denomination_courte text not null default '',
  interlocuteurs text not null default '',
  tel text not null default '',
  portable text not null default '',
  courriel text not null default '',
  site_web text not null default '',
  commune text not null default '',
  code_postal text not null default '',
  adresse text not null default '',
  complement_adresse text not null default '',
  produits_cles text not null default '',
  remarques text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.fournisseurs enable row level security;

-- Un utilisateur connecté peut lire tous les profils (annuaire
-- collaborateurs) ; seul un admin peut créer/modifier/supprimer.
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_admin_write" on public.profiles
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "sites_select_authenticated" on public.sites
  for select using (auth.role() = 'authenticated');

create policy "sites_admin_insert" on public.sites
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "sites_admin_update" on public.sites
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
create policy "sites_admin_delete" on public.sites
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "fournisseurs_select_authenticated" on public.fournisseurs
  for select using (auth.role() = 'authenticated');
create policy "fournisseurs_admin_insert" on public.fournisseurs
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "fournisseurs_admin_update" on public.fournisseurs
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "fournisseurs_admin_delete" on public.fournisseurs
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
