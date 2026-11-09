-- Le rattachement d'un relevé à sa visite (validation d'un BI Entretien sous
-- contrat) est une modification : sans politique UPDATE, la base la refusait
-- en silence. Réservé au bureau.
create policy "releves_admin_update" on public.releves
  for update using (public.is_admin()) with check (public.is_admin());

-- Rattrapage : relevés en attente des équipements ayant déjà une visite
-- validée, rattachés à la plus récente.
update public.releves r
set bon_intervention_id = v.bon_intervention_id,
    visite_numero = v.visite_numero,
    visite_total = v.visite_total,
    visite_annee = v.annee
from (
  select distinct on (equipement_id) equipement_id, bon_intervention_id, visite_numero, visite_total, annee
  from public.visites_entretien
  order by equipement_id, annee desc, visite_numero desc
) v
where v.equipement_id = r.equipement_id
  and r.bon_intervention_id is null;
