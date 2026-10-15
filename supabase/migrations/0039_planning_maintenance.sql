-- Planning Maintenance — remplace le classeur Excel/VBA utilisé jusqu'ici
-- par le bureau. Un créneau pointe soit vers un site (entretien
-- récurrent), soit vers un devis (affaire sur devis, travaux ponctuels),
-- soit vers rien (absence) — contrairement au vieux classeur qui
-- simulait une absence avec un faux client "Absence"/site "Congé", ici
-- le type est un vrai champ structuré.
--
-- Plusieurs techniciens par créneau (confirmé par l'ancien système) :
-- table de jonction `creneau_techniciens`, PAS un text[] comme
-- bons_intervention.techniciens (qui stocke des noms) — on a ici besoin
-- d'un vrai filtrage RLS "mes créneaux" par technicien connecté.

create table public.creneaux_planning (
  id uuid primary key default gen_random_uuid(),

  type_creneau text not null default 'intervention'
    check (type_creneau in ('intervention', 'absence')),

  -- Intervention : site_id obligatoire, devis_id optionnel (affaire
  -- précise si le créneau porte sur une affaire sur devis plutôt que
  -- sur l'entretien récurrent du site). Absence : les deux restent null.
  site_id uuid references public.sites(id) on delete set null,
  devis_id uuid references public.devis(id) on delete set null,
  -- Instantanés affichage (même logique que bons_intervention) — le
  -- planning doit rester lisible même si le site est renommé plus tard.
  client_nom text not null default '',
  site text not null default '',

  -- Absence uniquement : motif libre côté bureau ("Congés payés", "RTT",
  -- "Maladie", "Formation"...) — pas de table de référence séparée pour
  -- un champ aussi simple.
  motif_absence text not null default '',

  date date not null,
  -- Heure de début optionnelle : le vieux classeur ne planifiait qu'en
  -- heures/jour, pas en créneau horaire précis. Si renseignée, sert à
  -- construire un évènement calendrier avec horaire ; sinon le lien
  -- "Ajouter à mon calendrier" crée un évènement journée entière.
  heure_debut time,
  heures_prevues numeric(4,2) not null check (heures_prevues > 0),

  observations text not null default '',
  annule boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint creneau_site_coherent check (
    (type_creneau = 'absence' and site_id is null and devis_id is null)
    or (type_creneau = 'intervention' and site_id is not null)
  )
);

create index creneaux_planning_date_idx on public.creneaux_planning(date);
create index creneaux_planning_site_id_idx on public.creneaux_planning(site_id);

create trigger set_updated_at
  before update on public.creneaux_planning
  for each row execute function public.set_updated_at();

-- Jours fériés + week-ends BLOQUÉS (choix explicite du bureau, pas une
-- simple alerte) — contrôlé en base pour ne jamais pouvoir être
-- contourné par un appel direct à l'API Supabase, en plus du contrôle
-- (plus lisible) côté Server Action.
create function public.verifier_jour_ouvre_creneau()
returns trigger
language plpgsql
as $$
begin
  if extract(isodow from new.date) in (6, 7) then
    raise exception 'Impossible de planifier un créneau un week-end (%).', new.date;
  end if;
  if exists (select 1 from public.jours_feries where date = new.date) then
    raise exception 'Impossible de planifier un créneau un jour férié (%).', new.date;
  end if;
  return new;
end;
$$;

create trigger verifier_jour_ouvre
  before insert or update on public.creneaux_planning
  for each row execute function public.verifier_jour_ouvre_creneau();

alter table public.creneaux_planning enable row level security;

-- Table de jonction — plusieurs techniciens par créneau.
create table public.creneau_techniciens (
  creneau_id uuid not null references public.creneaux_planning(id) on delete cascade,
  technicien_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creneau_id, technicien_id)
);

create index creneau_techniciens_technicien_id_idx on public.creneau_techniciens(technicien_id);

alter table public.creneau_techniciens enable row level security;

-- Fonction security definer (même pattern que is_admin()/is_staff(),
-- voir 0002/0004) : évite toute récursion RLS en contournant
-- intentionnellement la policy pour cette seule vérification
-- d'appartenance, plutôt qu'une sous-requête directe dans la policy
-- qui réapplique la même policy à l'infini.
create function public.est_technicien_du_creneau(p_creneau_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.creneau_techniciens
    where creneau_id = p_creneau_id and technicien_id = auth.uid()
  );
$$;

-- Première fois dans l'app qu'une table est filtrée "mes données" par
-- l'utilisateur connecté (jusqu'ici tout le staff voit tout). L'admin
-- voit tout, un technicien ne voit que les créneaux où il figure dans
-- creneau_techniciens.
create policy "creneaux_planning_select" on public.creneaux_planning
  for select using (public.is_admin() or public.est_technicien_du_creneau(id));
create policy "creneaux_planning_admin_write" on public.creneaux_planning
  for all using (public.is_admin()) with check (public.is_admin());

create policy "creneau_techniciens_select" on public.creneau_techniciens
  for select using (public.is_admin() or public.est_technicien_du_creneau(creneau_id));
create policy "creneau_techniciens_admin_write" on public.creneau_techniciens
  for all using (public.is_admin()) with check (public.is_admin());
