-- Fondations : legacy_id pour l'import Firestore, rôle client (à
-- venir), sites_view en security_invoker, trigger updated_at,
-- lecture restreinte au personnel interne (admin/technicien) — le
-- futur rôle client aura ses propres accès restreints (table
-- client_acces, prompt 11), jamais un accès large comme aujourd'hui.

alter table public.sites add column if not exists legacy_id text unique;
alter table public.fournisseurs add column if not exists legacy_id text unique;
alter table public.profiles add column if not exists legacy_id text unique;

alter type public.user_role add value if not exists 'client';

-- create or replace ne peut pas insérer une colonne avant la fin de la
-- liste existante (ici legacy_id se retrouverait avant hors_contrat) :
-- il faut recréer la vue plutôt que la remplacer.
drop view if exists public.sites_view;
create view public.sites_view
  with (security_invoker = true) as
  select *, (n_affaire like '362-%') as hors_contrat from public.sites;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.sites;
create trigger set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.fournisseurs;
create trigger set_updated_at
  before update on public.fournisseurs
  for each row execute function public.set_updated_at();

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'technicien')
  );
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_staff" on public.profiles
  for select using (public.is_staff());

drop policy if exists "sites_select_authenticated" on public.sites;
create policy "sites_select_staff" on public.sites
  for select using (public.is_staff());

drop policy if exists "fournisseurs_select_authenticated" on public.fournisseurs;
create policy "fournisseurs_select_staff" on public.fournisseurs
  for select using (public.is_staff());
