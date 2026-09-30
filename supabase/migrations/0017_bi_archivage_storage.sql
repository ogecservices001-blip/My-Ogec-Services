-- Archivage du BI (Prompt 9c) — remplace les colonnes prévues pour
-- Google Drive (jamais utilisées, aucun bon réel n'existe encore) par
-- des chemins Supabase Storage : décision explicite de l'utilisateur
-- de ne pas construire le flux OAuth Google Drive (absent du portage
-- Next.js) pour ce module, une solution 100% Supabase suffit.

alter table public.bons_intervention
  drop column drive_bi_folder_id,
  drop column pdf_drive_url,
  drop column json_drive_url,
  add column pdf_storage_path text not null default '',
  add column json_storage_path text not null default '';

insert into storage.buckets (id, name, public)
  values ('bi-archives', 'bi-archives', false)
  on conflict (id) do nothing;

create policy "bi_archives_staff_select" on storage.objects
  for select using (bucket_id = 'bi-archives' and public.is_staff());
create policy "bi_archives_staff_insert" on storage.objects
  for insert with check (bucket_id = 'bi-archives' and public.is_staff());
