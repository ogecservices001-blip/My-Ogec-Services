-- Suivi réglementaire CERFA (contrôle fluides frigorigènes) sur les 6
-- familles d'équipements concernées : date dernier/prochain contrôle
-- et n° de bordereau. CTA DD et UTADD n'avaient pas encore de
-- réfrigérant/charge (contrairement à UEVRV/SPLIT/GEG/ROOF) — ajouté
-- aussi pour elles, nécessaire au calcul de périodicité de contrôle.

update types_equipement
set champs_en_tete_supplementaires = champs_en_tete_supplementaires || '[
  {"cle": "typeRefrigerant", "label": "Réfrigérant", "options": [], "numerique": false, "unite": "", "memeLigneSuivant": false},
  {"cle": "chargeRefrigerant", "label": "Charge réfrigérant", "options": [], "numerique": false, "unite": "", "memeLigneSuivant": false}
]'::jsonb
where code in ('MOD CTA DD', 'MOD UTADD');

update types_equipement
set champs_en_tete_supplementaires = champs_en_tete_supplementaires || '[
  {"cle": "dateDernierControle", "label": "Date dernier contrôle", "options": [], "numerique": false, "unite": "", "memeLigneSuivant": false},
  {"cle": "dateProchainControle", "label": "Date Prochain contrôle", "options": [], "numerique": false, "unite": "", "memeLigneSuivant": false},
  {"cle": "numDernierBordereau", "label": "N° dernier bordereau", "options": [], "numerique": false, "unite": "", "memeLigneSuivant": false}
]'::jsonb
where code in ('MOD UEVRV', 'MOD SPLIT', 'MOD GEG', 'MOD ROOF', 'MOD CTA DD', 'MOD UTADD');
