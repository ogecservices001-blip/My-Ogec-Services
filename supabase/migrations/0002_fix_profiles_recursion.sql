-- Corrige une récursion infinie RLS : la policy "admin peut tout faire
-- sur profiles" vérifiait le rôle admin en relisant profiles, ce qui
-- redéclenchait sa propre RLS à l'infini (erreur Postgres 42P17) — et
-- empêchait donc TOUT LE MONDE, y compris un admin légitime, de lire
-- son propre profil. Remplacé par une fonction security definer, qui
-- contourne intentionnellement la RLS pour cette seule vérification.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check (public.is_admin());
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin());
create policy "profiles_admin_delete" on public.profiles
  for delete using (public.is_admin());

drop policy if exists "sites_admin_insert" on public.sites;
drop policy if exists "sites_admin_update" on public.sites;
drop policy if exists "sites_admin_delete" on public.sites;
create policy "sites_admin_insert" on public.sites
  for insert with check (public.is_admin());
create policy "sites_admin_update" on public.sites
  for update using (public.is_admin());
create policy "sites_admin_delete" on public.sites
  for delete using (public.is_admin());

drop policy if exists "fournisseurs_admin_insert" on public.fournisseurs;
drop policy if exists "fournisseurs_admin_update" on public.fournisseurs;
drop policy if exists "fournisseurs_admin_delete" on public.fournisseurs;
create policy "fournisseurs_admin_insert" on public.fournisseurs
  for insert with check (public.is_admin());
create policy "fournisseurs_admin_update" on public.fournisseurs
  for update using (public.is_admin());
create policy "fournisseurs_admin_delete" on public.fournisseurs
  for delete using (public.is_admin());
