-- Depuis le BI Entretien, le technicien peut rouvrir et corriger un relevé
-- tant qu'il n'est rattaché à aucune visite validée.
create policy "releves_staff_update_en_attente" on public.releves
  for update using (public.is_staff() and bon_intervention_id is null)
  with check (public.is_staff());
