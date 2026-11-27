alter table public.demandes_depannage
  add column if not exists accuse_envoye_le timestamptz,
  add column if not exists avis_intervention_envoye_le timestamptz;
