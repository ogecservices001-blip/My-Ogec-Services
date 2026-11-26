create table if not exists public.abonnements_push (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  appareil text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists abonnements_push_profile_idx on public.abonnements_push(profile_id);

alter table public.abonnements_push enable row level security;

drop policy if exists "abonnements_push lecture perso" on public.abonnements_push;
create policy "abonnements_push lecture perso" on public.abonnements_push
  for select using (profile_id = auth.uid());

drop policy if exists "abonnements_push ajout perso" on public.abonnements_push;
create policy "abonnements_push ajout perso" on public.abonnements_push
  for insert with check (profile_id = auth.uid());

drop policy if exists "abonnements_push maj perso" on public.abonnements_push;
create policy "abonnements_push maj perso" on public.abonnements_push
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "abonnements_push suppression perso" on public.abonnements_push;
create policy "abonnements_push suppression perso" on public.abonnements_push
  for delete using (profile_id = auth.uid());
