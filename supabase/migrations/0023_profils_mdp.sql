-- Mot de passe applicatif ("mdp My Ogec") d'un collaborateur, à titre de
-- pense-bête pour le bureau — jamais appliqué automatiquement sur le
-- compte Supabase Auth (ça reste une action manuelle séparée). Table
-- distincte de "profiles" (lu par tout le monde pour l'annuaire) afin
-- qu'aucun mot de passe ne transite jamais vers un compte non-admin :
-- seul un admin peut lire/écrire cette table.
create table public.profils_mdp (
  profil_id uuid primary key references public.profiles(id) on delete cascade,
  mdp_app text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.profils_mdp enable row level security;

create policy "profils_mdp_admin_all" on public.profils_mdp
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
