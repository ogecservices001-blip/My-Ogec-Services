-- Ressources Humaines — pointages. Stockage volontairement séparé du
-- planning : une fois importées pour un mois, les heures de paie ne
-- doivent plus bouger si le planning est modifié après coup (même
-- principe que l'ancienne extraction mensuelle Excel/VBA, qui figeait
-- une feuille "Pointage Mensuel" à partir du planning). Une ligne par
-- (technicien, créneau) — si un créneau a plusieurs techniciens,
-- chacun reçoit sa propre ligne avec les heures du créneau.

create table public.pointages (
  id uuid primary key default gen_random_uuid(),

  technicien_id uuid references public.profiles(id) on delete set null,
  technicien_nom text not null default '', -- instantané : le pointage doit rester lisible même si le profil change/est supprimé

  date date not null,
  mois text not null default '', -- "YYYY-MM", pour filtrer/grouper simplement

  heures numeric(4,2) not null default 0,
  client_nom text not null default '',
  site text not null default '',
  observations text not null default '',

  creneau_id uuid references public.creneaux_planning(id) on delete set null, -- traçabilité, jamais relu pour le calcul une fois importé

  importe_le timestamptz not null default now(),
  importe_par uuid references public.profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pointages_mois_idx on public.pointages(mois);
create index pointages_technicien_id_idx on public.pointages(technicien_id);

create trigger set_updated_at
  before update on public.pointages
  for each row execute function public.set_updated_at();

alter table public.pointages enable row level security;

-- Réservé au bureau (admin) — jamais le technicien, comme l'ancien
-- système (le pointage a toujours été une saisie/extraction bureau).
create policy "pointages_admin_only" on public.pointages
  for all using (public.is_admin()) with check (public.is_admin());
