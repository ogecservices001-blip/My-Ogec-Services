create table public.demandes_validation_client (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  cle_intervention text not null,
  site_id uuid references public.sites(id) on delete cascade,
  creneau_ids uuid[] not null default '{}',
  client_nom text not null default '',
  site text not null default '',
  objet text not null default '',
  jours jsonb not null default '[]'::jsonb,
  destinataire_email text not null,
  destinataire_nom text not null default '',
  copies text[] not null default '{}',
  message text not null default '',
  statut text not null default 'attente' check (statut in ('attente', 'valide', 'autre_date', 'remplacee')),
  envoye_le timestamptz not null default now(),
  relance1_le timestamptz,
  relance2_le timestamptz,
  sans_reponse_le timestamptz,
  reponse_le timestamptz,
  date_proposee date,
  moment text not null default '',
  commentaire text not null default '',
  traite_le timestamptz,
  motif_remplacement text not null default '' check (motif_remplacement in ('', 'nouvelle_demande', 'modification', 'replanification')),
  created_by uuid references public.profiles(id) on delete set null
);

create index demandes_validation_client_cle_idx on public.demandes_validation_client (cle_intervention);
create index demandes_validation_client_statut_idx on public.demandes_validation_client (statut);

alter table public.demandes_validation_client enable row level security;

create policy "demandes_validation_client_select_staff" on public.demandes_validation_client
  for select using (public.is_staff());
create policy "demandes_validation_client_admin_write" on public.demandes_validation_client
  for all using (public.is_admin()) with check (public.is_admin());
