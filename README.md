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

Le schéma vit dans `supabase/migrations/`, géré par la [CLI Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started) :

```bash
# Une seule fois : lie ce dossier au projet Supabase distant
npx supabase login
npx supabase link --project-ref zmpaminpdcxhyeqfebbf

# Applique les migrations pas encore poussées
npm run db:push

# Régénère les types TypeScript depuis le schéma distant
npm run db:types
```

`npm run db:types` écrit `src/lib/database.types.ts` — ne pas modifier ce fichier à la main, il est régénéré à chaque changement de schéma. `src/lib/types.ts` réexporte des alias pratiques à partir de ces types générés.

## Import Firestore → Supabase

Tant qu'un module reste saisi dans l'app Flutter, Firestore fait foi et ce dépôt le lit via un import rejouable (voir `docs/MIGRATION.md`, §4). Le script :

```bash
# Variables nécessaires (ne jamais commiter le fichier de clé) :
export FIREBASE_SERVICE_ACCOUNT_PATH=/chemin/hors-du-depot/service-account.json
export NEXT_PUBLIC_SUPABASE_URL=...        # déjà dans .env.local
export SUPABASE_SECRET_KEY=...             # déjà dans .env.local

npm run import:firestore -- --only=sites,fournisseurs,profiles
npm run import:firestore -- --dry-run      # simulation, n'écrit rien
```

Rejouable sans créer de doublon : chaque ligne porte un `legacy_id` (id du document Firestore d'origine), l'upsert se fait sur `id` en résolvant d'abord l'id existant via ce `legacy_id` — jamais un upsert direct sur `legacy_id`, qui écraserait l'id (et casserait tout ce qui le référence) à chaque ré-import.

Ajouter une collection : créer `scripts/mappers/<nom>.ts` (voir les mappers existants) et l'ajouter au tableau `MAPPERS` de `scripts/import-firestore.ts`, après les collections dont elle dépend.

## Structure

- `src/app/(app)/repertoire/` — module Répertoire (clients/sites,
  fournisseurs, collaborateurs)
- `src/lib/supabase/` — clients Supabase (navigateur, serveur, session
  middleware/proxy)
- `src/lib/profile.ts` — rôle de l'utilisateur connecté (admin /
  technicien), équivalent de `UserService.isCurrentUserAdmin()` côté
  Flutter
- `src/lib/auth.ts` — `requireProfile()`/`requireAdmin()`, à appeler en
  début de Server Component ou de Server Action pour protéger un accès
- `src/lib/database.types.ts` — types générés depuis le schéma Supabase
  (`npm run db:types`), ne pas éditer à la main
- `src/lib/types.ts` — alias de types pratiques par-dessus les types
  générés
- `docs/MIGRATION.md` — contexte permanent de la migration Flutter →
  Next.js (cartographie des données, conventions, avancement)
