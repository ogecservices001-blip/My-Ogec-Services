alter table public.demandes_validation_client
  add column historique jsonb not null default '[]'::jsonb;
