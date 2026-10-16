-- Stockage éphémère de l'analyse d'import équipements, côté serveur
-- uniquement : le navigateur ne manipule plus jamais la liste complète
-- des lignes analysées (sur un import "tous clients" de plusieurs
-- milliers de lignes, ce transport aller-retour faisait planter
-- l'onglet) — juste un identifiant.
create table public.imports_equipements_temp (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  site_ids uuid[] not null,
  lignes jsonb not null,
  created_at timestamptz not null default now()
);

create index imports_equipements_temp_created_at_idx on public.imports_equipements_temp(created_at);

alter table public.imports_equipements_temp enable row level security;

create policy "imports_equipements_temp_admin_all" on public.imports_equipements_temp
  for all using (public.is_admin()) with check (public.is_admin());
