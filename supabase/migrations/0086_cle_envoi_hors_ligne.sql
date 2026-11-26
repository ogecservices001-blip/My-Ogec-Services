-- Travail sans réseau : chaque saisie (CERFA, BI, relevé) porte un
-- identifiant créé sur le téléphone. Si un envoi est rejoué après une
-- coupure (le serveur avait enregistré mais la réponse s'est perdue), le
-- serveur le reconnaît et ne crée pas de doublon.
alter table public.cerfas add column cle_envoi text unique;
alter table public.bons_intervention add column cle_envoi text unique;
alter table public.releves add column cle_envoi text unique;
