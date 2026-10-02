-- Passe le signalement d'un champ libre à une saisie guidée (menu >
-- sous-menu > nature du problème), avec un numéro chrono comme les
-- autres documents de l'appli, et ajoute un journal des actions.
alter table public.signalements
  add column numero text not null default '',
  add column menu text not null default '',
  add column sous_menu text not null default '',
  add column nature text not null default '';
alter table public.signalements alter column message set default '';

create unique index signalements_numero_key on public.signalements (numero) where numero <> '';

-- Journal des actions sur un signalement (création, marqué traité,
-- rouvert...) — même principe que les relevés GMAO : un historique
-- horodaté séparé plutôt qu'un simple statut écrasé à chaque fois.
create table public.signalements_historique (
  id uuid primary key default gen_random_uuid(),
  signalement_id uuid not null references public.signalements(id) on delete cascade,
  auteur_nom text not null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.signalements_historique enable row level security;

create policy "signalements_historique_insert_authenticated" on public.signalements_historique
  for insert
  with check (auth.role() = 'authenticated');

create policy "signalements_historique_select_admin" on public.signalements_historique
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
