-- Email professionnel (boîte pro créée par le bureau, ex. maintbogsmb@
-- gmail.com) distinct de l'email de connexion Supabase Auth (qui
-- n'existe que si le compte a déjà été créé) et de l'email personnel
-- (email_perso). Permet de renseigner/afficher l'adresse pro d'un
-- collaborateur avant même la création de son compte applicatif.
alter table public.profiles add column email_pro text not null default '';
