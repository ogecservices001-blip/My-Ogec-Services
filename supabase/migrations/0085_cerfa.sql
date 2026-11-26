-- Module CERFA 15497 (portage de l'appli Flutter) : fiches d'intervention
-- fluides frigorigènes, archivées dans l'appli au lieu de Google Drive.

-- Qualité de chaque interlocuteur du site : le signataire client du
-- CERFA est choisi parmi eux (nom, qualité, email).
alter table public.sites
  add column qualite_interlocuteur_site text not null default '',
  add column qualite_interlocuteur_site_2 text not null default '',
  add column qualite_interlocuteur_site_3 text not null default '',
  add column qualite_interlocuteur_site_4 text not null default '';

drop view if exists public.sites_view;
create view public.sites_view
  with (security_invoker = true) as
  select *, (n_affaire like '362-%') as hors_contrat from public.sites;

-- Détecteurs de fuite (liste partagée, gérée depuis l'étape 3).
create table public.cerfa_detecteurs (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  date_controle date not null,
  created_at timestamptz not null default now()
);

alter table public.cerfa_detecteurs enable row level security;
create policy "cerfa_detecteurs_staff_select" on public.cerfa_detecteurs for select using (public.is_staff());
create policy "cerfa_detecteurs_staff_insert" on public.cerfa_detecteurs for insert with check (public.is_staff());
create policy "cerfa_detecteurs_staff_delete" on public.cerfa_detecteurs for delete using (public.is_staff());

-- Compteur annuel : n° de bordereau AA-NNN-client-site-équipement,
-- remis à 1 chaque 1er janvier. 2026 reprend après le 079 de l'ancienne appli.
create table public.cerfa_compteurs (
  annee integer primary key,
  valeur integer not null default 0
);
alter table public.cerfa_compteurs enable row level security;
insert into public.cerfa_compteurs (annee, valeur) values (2026, 79);

create or replace function public.cerfa_prochain_chrono(p_annee integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé';
  end if;
  insert into public.cerfa_compteurs (annee, valeur) values (p_annee, 1)
    on conflict (annee) do update set valeur = public.cerfa_compteurs.valeur + 1
    returning valeur into v;
  return v;
end;
$$;

-- CERFA finalisés.
create table public.cerfas (
  id uuid primary key default gen_random_uuid(),
  equipement_id uuid references public.equipements(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  annee integer not null,
  chrono integer not null,
  fiche_no text not null,
  numero text not null,
  client_nom text not null default '',
  site_nom text not null default '',
  n_affaire text not null default '',
  equipement_nom text not null default '',
  donnees jsonb not null default '{}'::jsonb,
  date_controle date not null,
  date_prochain_controle date,
  operateur_nom text not null default '',
  signataire_nom text not null default '',
  signataire_qualite text not null default '',
  signataire_email text not null default '',
  qte_chargees_neufs numeric(10,2),
  qte_chargees_maintenance numeric(10,2),
  qte_recup_maintenance numeric(10,2),
  qte_recup_hors_usage numeric(10,2),
  pdf_path text not null default '',
  envoye_le timestamptz,
  envoye_a text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (annee, chrono)
);

create index cerfas_equipement_idx on public.cerfas (equipement_id, created_at desc);
create index cerfas_site_idx on public.cerfas (site_id);

alter table public.cerfas enable row level security;
create policy "cerfas_staff_select" on public.cerfas for select using (public.is_staff());
create policy "cerfas_staff_insert" on public.cerfas for insert with check (public.is_staff());
create policy "cerfas_staff_update" on public.cerfas for update using (public.is_staff()) with check (public.is_staff());
create policy "cerfas_admin_delete" on public.cerfas for delete using (public.is_admin());

insert into storage.buckets (id, name, public)
  values ('cerfa-archives', 'cerfa-archives', false)
  on conflict (id) do nothing;

create policy "cerfa_archives_staff_select" on storage.objects
  for select using (bucket_id = 'cerfa-archives' and public.is_staff());
create policy "cerfa_archives_staff_insert" on storage.objects
  for insert with check (bucket_id = 'cerfa-archives' and public.is_staff());

-- « + Nouveau signataire » à la signature (technicien compris, alors que
-- les sites ne sont modifiables que par le bureau) : rangé dans la
-- première place d'interlocuteur libre du site, rien d'autre n'est touché.
-- Renvoie le n° de place utilisée, 0 si les 4 sont prises.
create or replace function public.cerfa_ajouter_signataire(
  p_site uuid, p_nom text, p_qualite text, p_email text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sites%rowtype;
begin
  if not public.is_staff() then
    raise exception 'Accès refusé';
  end if;
  select * into s from public.sites where id = p_site for update;
  if not found then
    return 0;
  end if;
  if coalesce(s.interlocuteur_site, '') = '' then
    update public.sites set interlocuteur_site = p_nom, qualite_interlocuteur_site = p_qualite,
      courriel_interlocuteur_site = p_email where id = p_site;
    return 1;
  elsif coalesce(s.interlocuteur_site_2, '') = '' then
    update public.sites set interlocuteur_site_2 = p_nom, qualite_interlocuteur_site_2 = p_qualite,
      courriel_interlocuteur_site_2 = p_email where id = p_site;
    return 2;
  elsif coalesce(s.interlocuteur_site_3, '') = '' then
    update public.sites set interlocuteur_site_3 = p_nom, qualite_interlocuteur_site_3 = p_qualite,
      courriel_interlocuteur_site_3 = p_email where id = p_site;
    return 3;
  elsif coalesce(s.interlocuteur_site_4, '') = '' then
    update public.sites set interlocuteur_site_4 = p_nom, qualite_interlocuteur_site_4 = p_qualite,
      courriel_interlocuteur_site_4 = p_email where id = p_site;
    return 4;
  end if;
  return 0;
end;
$$;
