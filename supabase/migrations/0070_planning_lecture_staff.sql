drop policy if exists "creneaux_planning_select" on public.creneaux_planning;
create policy "creneaux_planning_select" on public.creneaux_planning
  for select using (public.is_staff() or public.est_technicien_du_creneau(id));

drop policy if exists "creneau_techniciens_select" on public.creneau_techniciens;
create policy "creneau_techniciens_select" on public.creneau_techniciens
  for select using (public.is_staff() or public.est_technicien_du_creneau(creneau_id));
