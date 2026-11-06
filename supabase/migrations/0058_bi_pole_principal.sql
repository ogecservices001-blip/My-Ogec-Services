-- BI à plusieurs pages (devis à plusieurs natures) : pole = 'PN', chaque page
-- porte son propre type. La première page est stockée dans les champs du bon,
-- son type ici ; les suivantes dans interventions_supplementaires.
alter table public.bons_intervention
  add column pole_principal text not null default '';
