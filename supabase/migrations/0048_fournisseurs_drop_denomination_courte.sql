-- "Dénomination courte" abandonnée (plus utilisée par Bruno) — retirée
-- du fichier Excel, de la fiche fournisseur et du rapprochement OCR
-- (qui se base désormais sur Nom + Raison sociale exacte uniquement).
alter table public.fournisseurs
  drop column denomination_courte;
