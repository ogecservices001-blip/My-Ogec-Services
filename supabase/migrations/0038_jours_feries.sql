-- Jours fériés (nationaux + Réunion) — bloquent la pose d'un créneau de
-- planning (voir 0039). Table de référence, pas de legacy_id (aucune
-- donnée Firestore équivalente) : dates calculées une fois pour les
-- prochaines années puis rejouées, Pâques/Ascension/Pentecôte étant des
-- fêtes mobiles non calculables par une simple règle récurrente en SQL.

create table public.jours_feries (
  date date primary key,
  libelle text not null default '',
  -- false = fêtes légales pré-remplies par cette migration ; true = ajout
  -- manuel ultérieur par le bureau (fermeture exceptionnelle...), pour ne
  -- jamais écraser ces lignes si un futur script de réimport des fêtes
  -- légales est rejoué.
  cree_par_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.jours_feries enable row level security;

create policy "jours_feries_select_staff" on public.jours_feries
  for select using (public.is_staff());
create policy "jours_feries_admin_write" on public.jours_feries
  for all using (public.is_admin()) with check (public.is_admin());

-- Fériés nationaux fixes (identiques toutes années) + 20 décembre
-- (Fête Kaf / abolition de l'esclavage, La Réunion uniquement).
insert into public.jours_feries (date, libelle) values
  ('2025-01-01','Jour de l''an'), ('2026-01-01','Jour de l''an'), ('2027-01-01','Jour de l''an'),
  ('2028-01-01','Jour de l''an'), ('2029-01-01','Jour de l''an'), ('2030-01-01','Jour de l''an'),
  ('2025-05-01','Fête du Travail'), ('2026-05-01','Fête du Travail'), ('2027-05-01','Fête du Travail'),
  ('2028-05-01','Fête du Travail'), ('2029-05-01','Fête du Travail'), ('2030-05-01','Fête du Travail'),
  ('2025-05-08','Victoire 1945'), ('2026-05-08','Victoire 1945'), ('2027-05-08','Victoire 1945'),
  ('2028-05-08','Victoire 1945'), ('2029-05-08','Victoire 1945'), ('2030-05-08','Victoire 1945'),
  ('2025-07-14','Fête nationale'), ('2026-07-14','Fête nationale'), ('2027-07-14','Fête nationale'),
  ('2028-07-14','Fête nationale'), ('2029-07-14','Fête nationale'), ('2030-07-14','Fête nationale'),
  ('2025-08-15','Assomption'), ('2026-08-15','Assomption'), ('2027-08-15','Assomption'),
  ('2028-08-15','Assomption'), ('2029-08-15','Assomption'), ('2030-08-15','Assomption'),
  ('2025-11-01','Toussaint'), ('2026-11-01','Toussaint'), ('2027-11-01','Toussaint'),
  ('2028-11-01','Toussaint'), ('2029-11-01','Toussaint'), ('2030-11-01','Toussaint'),
  ('2025-11-11','Armistice 1918'), ('2026-11-11','Armistice 1918'), ('2027-11-11','Armistice 1918'),
  ('2028-11-11','Armistice 1918'), ('2029-11-11','Armistice 1918'), ('2030-11-11','Armistice 1918'),
  ('2025-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2026-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2027-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2028-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2029-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2030-12-20','Fête Kaf — abolition de l''esclavage (Réunion)'),
  ('2025-12-25','Noël'), ('2026-12-25','Noël'), ('2027-12-25','Noël'),
  ('2028-12-25','Noël'), ('2029-12-25','Noël'), ('2030-12-25','Noël')
on conflict (date) do nothing;

-- Fêtes mobiles (Lundi de Pâques, Ascension, Lundi de Pentecôte) —
-- calculées avec l'algorithme de Pâques grégorien (Meeus/Jones/Butcher),
-- vérifiées par un script Node indépendant avant d'écrire cette migration.
insert into public.jours_feries (date, libelle) values
  ('2025-04-21','Lundi de Pâques'), ('2025-05-29','Ascension'), ('2025-06-09','Lundi de Pentecôte'),
  ('2026-04-06','Lundi de Pâques'), ('2026-05-14','Ascension'), ('2026-05-25','Lundi de Pentecôte'),
  ('2027-03-29','Lundi de Pâques'), ('2027-05-06','Ascension'), ('2027-05-17','Lundi de Pentecôte'),
  ('2028-04-17','Lundi de Pâques'), ('2028-05-25','Ascension'), ('2028-06-05','Lundi de Pentecôte'),
  ('2029-04-02','Lundi de Pâques'), ('2029-05-10','Ascension'), ('2029-05-21','Lundi de Pentecôte'),
  ('2030-04-22','Lundi de Pâques'), ('2030-05-30','Ascension'), ('2030-06-10','Lundi de Pentecôte')
on conflict (date) do nothing;
