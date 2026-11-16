alter table public.demandes_validation_client
  add column dates_proposees jsonb not null default '[]'::jsonb;
