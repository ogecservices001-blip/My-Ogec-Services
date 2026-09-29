-- Le flux public (page /q/{code}) appelle prochain_chrono() via le
-- client admin (clé secrète, rôle service_role) — sécurité par défaut
-- via GRANT explicite plutôt que de supposer que service_role hérite
-- déjà du droit d'exécution sur une fonction tout juste créée.
grant execute on function public.prochain_chrono(text, integer) to service_role;
