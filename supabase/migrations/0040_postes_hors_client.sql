-- Postes hors client — travail planifiable qui n'est rattaché à aucun
-- client (formation, sous-traitance interne, bureau, fournisseurs,
-- absences...). Remplace le couple type_creneau='absence'/motif_absence
-- improvisé en 0039 par un vrai référentiel, fourni par le bureau
-- (fichier "Postes Hors Client.xlsx"). `item` est la clé unique (le
-- N°Affaire legacy, lui, n'est PAS unique : "Bureau/Réunions" et
-- "Bureau/Matériels" partagent le code 2000 dans le fichier source).

create table public.postes_hors_client (
  id uuid primary key default gen_random_uuid(),
  item text not null unique,
  client text not null default '',
  site text not null default '',
  numero_legacy text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.postes_hors_client
  for each row execute function public.set_updated_at();

alter table public.postes_hors_client enable row level security;

create policy "postes_hors_client_select_staff" on public.postes_hors_client
  for select using (public.is_staff());
create policy "postes_hors_client_admin_write" on public.postes_hors_client
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.postes_hors_client (item, client, site, numero_legacy) values
  ('01', 'Formation', 'Ecole', '1000'),
  ('02', 'Formation', 'Professionnelle', '1001'),
  ('03', 'Sous-traitance', 'OGEC', '1002'),
  ('04', 'Divers', 'Non facturés', '1003'),
  ('05', 'Absence', 'Congé', '1004'),
  ('06', 'Absence', 'Férié', '1005'),
  ('07', 'Absence', 'Maladie', '1006'),
  ('08', 'Absence', 'Injustifiée', '1007'),
  ('09', 'Absence', 'Récupération', '1008'),
  ('10', 'Absence', 'Paternité', '1009'),
  ('11', 'Absence', 'Maternité', '1010'),
  ('12', 'Bureau', 'Réunions', '2000'),
  ('13', 'Bureau', 'Matériels', '2000'),
  ('14', 'Fournisseurs', 'Approvisionnement', '3000');

-- Remplace type_creneau/motif_absence : un créneau pointe soit vers un
-- site (intervention), soit vers un poste hors client — jamais les
-- deux, jamais ni l'un ni l'autre. Aucune donnée existante ne porte
-- type_creneau='absence' (vérifié avant d'écrire cette migration),
-- rien à migrer.
alter table public.creneaux_planning
  add column poste_hors_client_id uuid references public.postes_hors_client(id) on delete restrict;

alter table public.creneaux_planning drop constraint creneau_site_coherent;
alter table public.creneaux_planning
  add constraint creneau_site_ou_poste check (
    (site_id is not null and poste_hors_client_id is null)
    or (site_id is null and devis_id is null and poste_hors_client_id is not null)
  );

alter table public.creneaux_planning drop column type_creneau;
alter table public.creneaux_planning drop column motif_absence;

create index creneaux_planning_poste_hors_client_id_idx on public.creneaux_planning(poste_hors_client_id);

-- Le jour férié/week-end ne bloque plus que les vraies interventions
-- client : un poste hors client (notamment "Absence/Férié") doit
-- justement pouvoir être posé un jour férié.
create or replace function public.verifier_jour_ouvre_creneau()
returns trigger
language plpgsql
as $$
begin
  if new.site_id is not null then
    if extract(isodow from new.date) in (6, 7) then
      raise exception 'Impossible de planifier une intervention client un week-end (%).', new.date;
    end if;
    if exists (select 1 from public.jours_feries where date = new.date) then
      raise exception 'Impossible de planifier une intervention client un jour férié (%).', new.date;
    end if;
  end if;
  return new;
end;
$$;
