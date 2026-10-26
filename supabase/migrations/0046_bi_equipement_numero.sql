-- Numéro d'équipement (3ème partie de l'identifiant Numéro Client-
-- Numéro Site-N°), saisi par le bureau à la validation d'un BI
-- Installation neuve — comme equipement_nom, jamais rempli par le
-- technicien (voir VueCorrection côté bi/[id]/detail.tsx).
alter table public.bons_intervention
  add column equipement_numero text not null default '';
