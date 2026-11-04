-- Localisation du devis — texte libre, indépendant de l'équipement du
-- parc GMAO (equipement_id) : utile notamment pour une Installation
-- neuve, où l'équipement n'existe pas encore dans le parc au moment du
-- devis. Pré-remplie depuis l'équipement choisi sur "Nouveau devis",
-- mais toujours modifiable, et seule source fiable après un aller-
-- retour export/import (l'export ne réinjectait rien jusqu'ici).
alter table public.devis
  add column localisation text not null default '';
