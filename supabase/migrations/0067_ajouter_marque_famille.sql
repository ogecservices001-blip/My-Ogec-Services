-- Sur le terrain, un technicien peut ajouter une marque à la liste d'une
-- famille (et rien d'autre : le reste des familles se modifie au bureau).
-- Le contrôle des doublons (accents, majuscules) est fait par l'appli avant
-- l'appel ; la fonction refuse en plus un doublon exact sans tenir compte de la casse.
create or replace function public.ajouter_marque_famille(p_type_id uuid, p_marque text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marque text := btrim(p_marque);
begin
  if not public.is_staff() then
    raise exception 'Non autorisé';
  end if;
  if v_marque = '' or length(v_marque) > 60 then
    raise exception 'Marque invalide';
  end if;

  update public.types_equipement t
  set champs_en_tete_supplementaires = (
    select jsonb_agg(
      case
        when c->>'cle' = 'marque'
          and not exists (
            select 1 from jsonb_array_elements_text(coalesce(c->'options', '[]'::jsonb)) o
            where lower(btrim(o)) = lower(v_marque)
          )
        then jsonb_set(c, '{options}', coalesce(c->'options', '[]'::jsonb) || to_jsonb(v_marque))
        else c
      end
      order by ord
    )
    from jsonb_array_elements(t.champs_en_tete_supplementaires) with ordinality as e(c, ord)
  )
  where t.id = p_type_id;
end;
$$;

revoke all on function public.ajouter_marque_famille(uuid, text) from public;
grant execute on function public.ajouter_marque_famille(uuid, text) to authenticated;
