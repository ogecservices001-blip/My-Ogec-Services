-- Permet de créer un dépannage depuis le bureau (pas seulement via la
-- page publique QR) : intervenant assigné + date d'intervention prévue,
-- comme le classeur "Suivi dépannage.xlsm" existant (colonnes
-- Intervenant / Date intervention prévue de la feuille "Chrono
-- Dépannage") — récap hebdo/annuel par intervenant volontairement pas
-- repris pour l'instant.

alter table public.demandes_depannage
  add column intervenant_id uuid references public.profiles(id) on delete set null,
  add column date_intervention_prevue date;

create policy "demandes_depannage_staff_insert" on public.demandes_depannage
  for insert with check (public.is_staff());
