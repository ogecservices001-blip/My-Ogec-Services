# My Ogec Services

Réécriture de l'application OGEC Services (jusqu'ici Flutter + Firebase,
voir le repo `ogec_services_app`) sur **Next.js + Supabase**, pour
converger vers le même stack que le reste de l'entreprise.

Migration en cours, module par module. **Répertoire** est le premier
module porté (clients/sites, fournisseurs, annuaire collaborateurs).

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS)
- [Supabase](https://supabase.com) — base de données Postgres, auth,
  stockage
- Une appli mobile (React Native ou Capacitor) viendra ensuite
  au-dessus de ce même backend, pour l'usage terrain

## Démarrer en local

1. Copier `.env.local.example` en `.env.local` et remplir les clés
   Supabase (Project Settings → API sur le dashboard Supabase) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clé publique)
   - `SUPABASE_SECRET_KEY` (clé secrète — jamais commitée, jamais
     exposée côté client)
2. Installer les dépendances : `npm install`
3. Lancer le serveur de dev : `npm run dev`

## Base de données

Le schéma vit dans `supabase/migrations/`. Pour l'instant, à appliquer
manuellement : copier le contenu du fichier de migration dans l'éditeur
SQL du dashboard Supabase et l'exécuter (pas encore relié à la CLI
Supabase).

## Structure

- `src/app/repertoire/` — module Répertoire (clients/sites,
  fournisseurs, collaborateurs)
- `src/lib/supabase/` — clients Supabase (navigateur, serveur, session
  middleware/proxy)
- `src/lib/profile.ts` — rôle de l'utilisateur connecté (admin /
  technicien), équivalent de `UserService.isCurrentUserAdmin()` côté
  Flutter
- `src/lib/types.ts` — types TypeScript miroir des tables Supabase
