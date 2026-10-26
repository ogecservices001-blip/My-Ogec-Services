-- Calcul de prix du devis (port du classeur Excel "Devis MOD.xlsm") :
-- lignes d'articles (matière + main d'œuvre par ligne, type de
-- coefficient) et bloc "Feuille de vente" (coût de revient détaillé
-- R1-R5 → marge cible → prix de vente → coefficient de vente appliqué
-- aux lignes). Tout est recalculé à l'affichage depuis ces deux colonnes
-- (voir src/lib/devis/pricing.ts) — montant/heures_prevues/
-- debours_materiel_prevu restent les totaux dénormalisés déjà existants.
alter table public.devis
  add column lignes jsonb not null default '[]'::jsonb,
  add column cout_revient jsonb not null default '{}'::jsonb;
