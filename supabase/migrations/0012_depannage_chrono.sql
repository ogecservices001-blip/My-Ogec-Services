-- Le numéro de ticket réel du bureau est au format "AAAA-NNN" (compteur
-- remis à zéro chaque année), pas une séquence globale plate — constaté
-- sur un email de confirmation réel (ex: "Int. N°2026-278"). Remplace
-- le numéro séquentiel plat du Prompt précédent.
--
-- `compteurs`/`prochain_chrono` est le même mécanisme prévu pour les
-- chronos Bon d'intervention (docs/MIGRATION.md, "chronos" → un doc par
-- année, incrémenté par transaction) — posé ici en générique
-- (clé + année) pour être réutilisé tel quel quand BI sera porté,
-- plutôt que d'avoir deux implémentations différentes.

create table public.compteurs (
  cle text not null,
  annee integer not null,
  valeur integer not null default 0,
  primary key (cle, annee)
);

alter table public.compteurs enable row level security;
-- Pas de policy directe : jamais lu/écrit qu'au travers de
-- prochain_chrono() (security definer), jamais par un accès table brut.

create function public.prochain_chrono(p_cle text, p_annee integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valeur integer;
begin
  insert into public.compteurs (cle, annee, valeur)
  values (p_cle, p_annee, 1)
  on conflict (cle, annee) do update set valeur = compteurs.valeur + 1
  returning valeur into v_valeur;
  return v_valeur;
end;
$$;

grant execute on function public.prochain_chrono(text, integer) to authenticated;

alter table public.demandes_depannage drop column numero;
drop sequence if exists public.demandes_depannage_numero_seq;
alter table public.demandes_depannage add column numero text not null default '';

-- Backfill de l'unique ligne déjà présente (import Firestore), avec le
-- même mécanisme que les nouveaux tickets.
do $$
declare
  r record;
  v_annee integer;
  v_valeur integer;
begin
  for r in select id, date_creation from public.demandes_depannage order by date_creation asc loop
    v_annee := extract(year from r.date_creation);
    v_valeur := public.prochain_chrono('depannage', v_annee);
    update public.demandes_depannage set numero = v_annee || '-' || v_valeur where id = r.id;
  end loop;
end $$;
