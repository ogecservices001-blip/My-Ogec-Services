create table public.rh_parametres (
  id smallint primary key default 1 check (id = 1),
  duree_legale_hebdo numeric not null default 35,
  plafond_hs25_hebdo numeric not null default 39,
  panier_montant numeric not null default 13.40,
  panier_seuil_heures numeric not null default 5,
  horaire_lundi numeric not null default 7.5,
  horaire_mardi numeric not null default 7.5,
  horaire_mercredi numeric not null default 7.5,
  horaire_jeudi numeric not null default 7.5,
  horaire_vendredi numeric not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.rh_parametres (id) values (1);

create table public.rh_bareme_communes (
  id uuid primary key default gen_random_uuid(),
  commune text not null,
  prime_trajet numeric not null default 0,
  prime_transport numeric not null default 0,
  date_valeur date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rh_bareme_communes_commune_idx on public.rh_bareme_communes (lower(commune));
insert into public.rh_bareme_communes (commune, prime_trajet, prime_transport, date_valeur) values
  ('Bras-Panon', 20.83, 10.33, null),
  ('Cilaos', 29.64, 14.72, null),
  ('Entre-Deux', 20.83, 10.33, null),
  ('L''Étang-Salé', 13.06, 6.49, null),
  ('La Plaine-des-Palmistes', 32.47, 16.11, null),
  ('La Possession', 4.95, 2.45, null),
  ('Le Port', 3.17, 1.58, null),
  ('Le Tampon', 23.65, 11.74, null),
  ('Les Avirons', 14.83, 7.36, null),
  ('Les Trois-Bassins', 9.52, 4.73, null),
  ('Petite Ile', 22.93, 11.38, null),
  ('Piton Saint-Leu', 8.48, 4.21, null),
  ('Ravine Des Cabris', 0, 0, null),
  ('Rivière Saint-Louis', 0, 0, null),
  ('Saint-André', 19.05, 9.46, null),
  ('Saint-Benoît', 23.3, 11.57, null),
  ('Saint-Denis', 9.52, 4.73, null),
  ('Saint-Gilles Les Hauts', 0, 0, null),
  ('Saint-Gilles-Les-Bains', 3.17, 1.58, null),
  ('Saint-Joseph', 25.76, 12.79, null),
  ('Saint-Leu', 8.48, 4.21, null),
  ('Saint-Louis', 16.95, 8.41, null),
  ('Saint-Paul', 0, 0, null),
  ('Saint-Philippe', 31.42, 15.59, null),
  ('Saint-Pierre', 20.12, 9.99, null),
  ('Sainte-Clotilde', 9.52, 4.73, null),
  ('Sainte-Marie', 13.95, 6.92, null),
  ('Sainte-Rose', 28.94, 14.37, null),
  ('Sainte-Suzanne', 16.08, 7.97, null),
  ('Salazie', 24.36, 12.09, null);

create table public.rh_salaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nom_paie text not null,
  categorie text not null default 'technique' check (categorie in ('technique', 'administratif')),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.rh_salaries (profile_id, nom_paie, categorie, actif) values
  ('f4704de1-a171-427f-9d38-5b01fd084e1d', 'AHAMADI Toilali', 'technique', true),
  ('3d783ffa-ee0b-47e2-89f4-1c1fb7886af2', 'CHAMCIRKAN-ATCHABY Dimitri', 'technique', true),
  ('544b34f5-3784-416b-bbab-332d7b29c006', 'CORSET Jean-Olivier', 'technique', true),
  ('a9ab0c74-e2c2-4fff-ad19-56cc233dfc5b', 'GRONDIN Guillaume', 'technique', true),
  ('e3a3cb1c-dcf9-433f-be7c-c29e3bb941a9', 'LAMY Jean-Fabrice', 'technique', true),
  ('677630f3-03d3-4193-a28d-7cd4caba80e4', 'MAILLOT Jean-Cyrille', 'technique', true),
  ('98a2189f-6ca7-41f7-b10f-4b2be78eb8ec', 'MOUNICHY Julçay', 'technique', true),
  ('811e1af3-b047-4ce4-801d-5f1034176c4d', 'RAMSAMY-ANGANIN Nicolas', 'technique', true),
  ('6b28cb0e-49a4-4859-8bec-72aa474f13a4', 'ROBERT Ludovic', 'technique', true),
  ('9a17f339-1e21-44b8-9a48-c7e7a5895fa2', 'ROSSE Bryan', 'technique', true),
  (null, 'ROBERT Daniel', 'technique', false),
  ('af0cea08-81bd-4b98-8843-9aadc84a138a', 'IMOUCHA Rachel', 'administratif', true),
  ('ea800164-417c-4316-8265-1791c8dd6585', 'LIXIVEL Elino', 'administratif', true),
  (null, 'MOELLON Kevin', 'administratif', false),
  ('ba8091b3-f346-42cb-83c4-b947c17d14de', 'GAUDIN Bruno', 'administratif', true),
  ('2cc710b9-930e-4e0d-b786-41e3549354b4', 'DUC Olivier', 'administratif', false),
  ('b63d3b2f-be4b-4d71-bdbb-7839ca074a61', 'MOUTAMA Johan', 'administratif', false),
  ('4a1bd5c9-5d64-4434-804d-c761678684b7', 'PLANTIER Stephane', 'administratif', false);

create table public.rh_motifs_absence (
  id uuid primary key default gen_random_uuid(),
  motif text not null,
  code_paie text not null default '',
  exclu_comptage_heures boolean not null default true,
  exclu_panier boolean not null default true,
  poste_hors_client_id uuid references public.postes_hors_client(id) on delete set null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index rh_motifs_absence_motif_idx on public.rh_motifs_absence (lower(motif));
insert into public.rh_motifs_absence (motif, code_paie, exclu_comptage_heures, exclu_panier, poste_hors_client_id, ordre) values
  ('Congés payés', '1004', true, true, 'fdae616d-0dfe-40dd-9de9-0174ed483856', 1),
  ('Jour férié', '1005', true, true, '6f4626e0-3d22-461e-8e16-5f467f43b052', 2),
  ('Maladie', '1006', true, true, '09d71c11-c134-45d7-9bb7-e4a47ea024f5', 3),
  ('Non justifiée', '1007', true, true, '23d9ed33-4556-49cb-8229-968872179696', 4),
  ('Récupération', '1008', true, true, 'cb8ace78-a53b-4449-b494-e573bca98fa4', 5),
  ('Congés paternité', '1009', true, true, 'd383cb05-3645-4b34-937c-d7fcf29ce85d', 6),
  ('Congés maternité', '1010', true, true, '58cf7a3a-98dd-4ffb-8b6a-dd86d3b8fc06', 7);

alter table public.rh_parametres enable row level security;
alter table public.rh_bareme_communes enable row level security;
alter table public.rh_salaries enable row level security;
alter table public.rh_motifs_absence enable row level security;
create policy "rh_parametres_admin" on public.rh_parametres for all using (public.is_admin()) with check (public.is_admin());
create policy "rh_bareme_communes_admin" on public.rh_bareme_communes for all using (public.is_admin()) with check (public.is_admin());
create policy "rh_salaries_admin" on public.rh_salaries for all using (public.is_admin()) with check (public.is_admin());
create policy "rh_motifs_absence_admin" on public.rh_motifs_absence for all using (public.is_admin()) with check (public.is_admin());
