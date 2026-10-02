-- Signalement retour terrain : bug/suggestion/remarque qu'un
-- collaborateur envoie sur l'appli elle-même. Tout le monde peut en
-- envoyer, seul le bureau (admin) voit/traite la liste reçue.
create type signalement_type as enum ('bug', 'suggestion', 'remarque');

create table public.signalements (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null references public.profiles(id),
  auteur_nom text not null,
  type signalement_type not null,
  message text not null,
  traite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.signalements enable row level security;

create policy "signalements_insert_authenticated" on public.signalements
  for insert
  with check (auth.role() = 'authenticated' and auteur_id = auth.uid());

create policy "signalements_select_admin" on public.signalements
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "signalements_update_admin" on public.signalements
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
