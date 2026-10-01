-- Référentiel BI : modèles de bon d'intervention par pôle — champs
-- guidés + checklist, même principe que le Référentiel GMAO (heures de
-- référence, familles d'équipement) : une donnée partagée, jamais
-- dupliquée, consultée en direct par l'assistant BI au moment de la
-- création. Modifier un modèle n'affecte jamais un BI déjà créé — seul
-- le prochain BI de ce pôle reprend la version à jour.

create table public.bi_modeles (
  id uuid primary key default gen_random_uuid(),
  pole text not null unique,
  -- Mêmes formes que types_equipement.champs_en_tete_supplementaires
  -- et .checklist (voir src/lib/gmao/types.ts ChampEnTete/ChecklistItem).
  champs jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  texte_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.bi_modeles
  for each row execute function public.set_updated_at();

alter table public.bi_modeles enable row level security;

create policy "bi_modeles_select_staff" on public.bi_modeles
  for select using (public.is_staff());
create policy "bi_modeles_admin_write" on public.bi_modeles
  for all using (public.is_admin()) with check (public.is_admin());

-- Valeurs saisies par le technicien pour les champs guidés/checklist
-- du modèle de son pôle — vides si le pôle n'a pas (encore) de modèle.
alter table public.bons_intervention
  add column modele_champs jsonb not null default '{}'::jsonb,
  add column checklist_values jsonb not null default '{}'::jsonb;
