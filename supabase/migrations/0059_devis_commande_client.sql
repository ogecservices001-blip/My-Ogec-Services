-- Commande du client (PDF, photo ou scan) jointe au devis accepté, reprise
-- dans le PDF du devis facturable. Liste de { chemin, nom, type, ajoute_le }.
alter table public.devis
  add column commande_client jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
  values ('devis-commandes', 'devis-commandes', false)
  on conflict (id) do nothing;

create policy "devis_commandes_admin_select" on storage.objects
  for select using (bucket_id = 'devis-commandes' and public.is_admin());
create policy "devis_commandes_admin_insert" on storage.objects
  for insert with check (bucket_id = 'devis-commandes' and public.is_admin());
create policy "devis_commandes_admin_delete" on storage.objects
  for delete using (bucket_id = 'devis-commandes' and public.is_admin());
