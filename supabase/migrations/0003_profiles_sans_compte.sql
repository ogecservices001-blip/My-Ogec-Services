-- Permet des fiches "profiles" sans compte de connexion (annuaire
-- collaborateur pas encore doté d'un accès à l'app), comme le rôle
-- "en_attente" existant côté Firestore. Jusqu'ici profiles.id devait
-- obligatoirement référencer un auth.users existant — on retire cette
-- contrainte stricte : pour un vrai compte, id reste conventionnellement
-- égal à l'uid Supabase Auth (getCurrentProfile() en dépend), mais une
-- fiche "en_attente" peut exister avec un id généré, sans compte.
alter table public.profiles drop constraint if exists profiles_id_fkey;
