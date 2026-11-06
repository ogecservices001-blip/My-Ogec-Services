-- Remise commerciale exceptionnelle sur l'ensemble du devis : en % ou en
-- euros, jamais les deux. Le montant du devis enregistré est le net remisé.
alter table public.devis
  add column remise_type text not null default '' check (remise_type in ('', 'pct', 'eur')),
  add column remise_valeur numeric,
  add column indice_revision text not null default '';

-- Versions précédentes d'un devis révisé (indice A, B, C...) : la ligne
-- devis porte toujours la version active, chaque révision archive ici la
-- version qu'elle remplace, telle quelle, pour pouvoir en ressortir le PDF.
create table public.devis_revisions (
  id uuid primary key default gen_random_uuid(),
  devis_id uuid not null references public.devis(id) on delete cascade,
  indice text not null default '',
  numero text not null,
  donnees jsonb not null,
  revise_par text not null default '',
  created_at timestamptz not null default now()
);

create index devis_revisions_devis_id_idx on public.devis_revisions(devis_id, created_at);

alter table public.devis_revisions enable row level security;

create policy "devis_revisions_select_staff" on public.devis_revisions
  for select using (public.is_staff());
create policy "devis_revisions_admin_write" on public.devis_revisions
  for all using (public.is_admin()) with check (public.is_admin());
