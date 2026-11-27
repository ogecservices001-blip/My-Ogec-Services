-- « Mon contrat OGEC », phase 3 : accord de devis en ligne et avis
-- « rapport de visite disponible ».

create table if not exists public.accords_devis (
  id uuid primary key default gen_random_uuid(),
  devis_id uuid not null references public.devis(id) on delete cascade,
  numero_devis text not null,
  email text not null,
  nom text not null,
  qualite text not null default '',
  signe_le timestamptz not null default now(),
  pdf_chemin text not null default ''
);
create index if not exists accords_devis_devis_idx on public.accords_devis (devis_id);

alter table public.accords_devis enable row level security;
drop policy if exists "accords_devis lecture admin" on public.accords_devis;
create policy "accords_devis lecture admin" on public.accords_devis for select using (public.is_admin());

alter table public.bons_intervention add column if not exists rapport_client_notifie_le timestamptz;
