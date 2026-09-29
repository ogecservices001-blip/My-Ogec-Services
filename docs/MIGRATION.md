# Migration OGEC Services — Flutter/Firebase vers Next.js/Supabase

Contexte permanent pour toutes les étapes de la migration. Ce dépôt (Next.js 16 App Router + Supabase) remplace progressivement l'app Flutter/Firebase située dans `../Ogec-Services-Applications`.

## 1. Collections Firestore → tables Supabase

Chaque table migrée porte une colonne `legacy_id text unique` = id du document Firestore d'origine, pour pouvoir rattacher les données importées par la suite (équipements, relevés, BI...) à leur site/client/équipement déjà migré.

### `users` → `profiles` ✅ migré
Pas de modèle Dart dédié (construit inline dans `user_service.dart`). Doc id = uid Firebase Auth, ou slug du nom pour les fiches "en attente" sans compte.
- `uid` (String), `email` (String), `role` (String : `admin`|`technicien`|`en_attente`), `name` (String), `portable` (String), `emailPerso` (String), `communeHabitation` (String), `vehicule` (String), `qualite` (String), `createdAt` (**Timestamp**)

### `clients` (1 doc = 1 site) → `sites` ✅ migré
`lib/features/annuaire/clients/client_model.dart`. **Tous les 66 champs sont des String**, y compris les dates et les montants (saisie libre, aucune conversion faite côté Flutter) : `nom`, `site`, `nAffaire` (hors contrat si commence par `362-`), `commune`, `codePostal`, `adresse`, `complementAdresse`, `epiSpecifique`, `habilitationSpecifique`, `moyenAcces`, `jourAcces`, `heuresAcces`, `delaiIntervention`, `interlocuteurSite`, `telFixeInterlocuteurSite`, `portableInterlocuteurSite`, `courrielInterlocuteurSite`, `freqEntretienAn`, `interlocuteurTiers`, `telFixeTiers`, `portableTiers`, `courrielTiers`, `remarquesLibres`, `nbHeuresVendues`, `nbHeuresVenduesAssistant`, `qteHeuresProgrammees`, `qteHeuresRestantes`, `tauxHoraireRegie`, `tauxHoraireVendu`, `forfaitDeplacement`, `dateOffre` (date-string), `datePriseEffetContrat` (date-string), `dateFinContrat` (date-string), `dureeContrat`, `montantContratAv`, `referenceOffreOgs`, `responsableContrat`, `telFixeResponsable`, `portableResponsable`, `courrielResponsable`, `adresseFacturation`, `codePostalFacturation`, `communeFacturation`, `complementAdresseFacturation`, `interlocuteurFacturation`, `telFixeInterlocuteurFacturation`, `portableInterlocuteurFacturation`, `courrielInterlocuteurFacturation`, `freqFactuAnnuelle`, `dateRevision` (date-string), `formuleRevisionEntretien`, `formuleRevisionDepannage`, `dateIndiceS` (date-string), `valeurIndiceS`, `dateIndiceCh` (date-string), `valeurIndiceCh`, `dateIndiceSPrime` (date-string), `valeurIndiceSPrime`, `dateIndiceChPrime` (date-string), `valeurIndiceChPrime`, `montantContratAvRevise`, `tauxHoraireRevise`, `forfaitDeplacementRevise`, `modifRiOuBg`.
- Fait, tout en `text` (phase 1). Typer plus tard dates/montants, et créer une table `clients` de regroupement par `nom` (aujourd'hui un simple regroupement d'affichage, pas une vraie relation).

### `suppliers` → `fournisseurs` ✅ migré
`lib/features/annuaire/suppliers/supplier_model.dart`, tout en String : `nom`, `denominationCourte`, `interlocuteurs`, `tel`, `portable`, `courriel`, `siteWeb`, `commune`, `codePostal`, `adresse`, `complementAdresse`, `produitsCles`, `remarques`.

### `types_equipement` → `types_equipement` (pas encore migré)
`lib/features/gmao/types_equipement/type_equipement_model.dart`. Id texte stable (`mod_roof`, `mod_split`...) à garder comme clé primaire.
- `code`, `nom`, `typeEquipement1Fixe` (String)
- `champsEnTeteSupplementaires` (jsonb) — liste de `ChampEnTete { cle, label, options[], numerique bool, unite, memeLigneSuivant bool }`
- `champsListes` (jsonb) — liste de `ChampListe { cle, label, sousChamps[] }`, `SousChamp { cle, label, unite }`
- `checklist` (jsonb) — liste de `ChecklistItem { rep int, label, typeValeur: 'bool'|'enum'|'text', options[] }`
- `groupesMesures` (jsonb) — liste de `GroupeMesure { cle, label, repetable bool, nombreMax int, champs[] }`, `ChampMesure { cle, label, unite }`

### `equipements` → `equipements` (pas encore migré)
`lib/features/gmao/equipements/equipement_model.dart`. `clientId` → `site_id` FK, `typeEquipementId` → `type_equipement_id` FK, `referenceHoraireId` → FK nullable.
- `nom`, `numeroEquipement`, `localisation`, `groupe`, `horsContrat` (bool), `remarqueTechnicien`
- `champsEnTete` (jsonb) — schéma polymorphe piloté par `types_equipement` (clés/valeurs variables selon la famille ; peut contenir des listes de maps pour les `ChampListe`)
- Ajouter `code_qr text unique` (voir §6).
- ⚠️ Le module CERFA a **son propre référentiel équipements, séparé et non relié** : un Google Sheet (`sheets_service.dart`, classe `Equipement` avec des clés en français type `'Numéro Client'`), à ne pas confondre avec cette collection. Décision prise : on n'importe plus depuis ce Sheet, `equipements` (Supabase) devient la seule source dès le module CERFA (prompt 10) ; les dernières données du Sheet seront réimportées une fois via `Dossier sources divers/Base de Données-CERFFA/Liste des équipements frigorifique OGS 2026.xlsx`.

### `releves` → `releves` (pas encore migré)
`lib/features/gmao/releve/releve_model.dart`. `equipementId`/`clientId` → FK.
- `date` (**Timestamp**), `nomTech`, `validationFonctionnement` (String?), `remarque1`, `remarque2`, `informationsInternes`, `photos` (List<String>, URLs Storage)
- `checklistValues` (jsonb) — clé = `ChecklistItem.rep`
- `groupesMesures` (jsonb) — clé = `GroupeMesure.cle`, valeur = liste d'occurrences (une par répétition)
- `informationsInternes` ne doit jamais être exposé au futur rôle `client`.

### `references_horaires` → `references_horaires` (pas encore migré)
`lib/features/gmao/references_horaires/reference_horaire_model.dart`.
- `designation`, `typeEquipement1/2/3` (String), `hrsTechAn`, `hrsAssistantAn`, `hrsTechSem`, `hrsAssistantSem`, `hrsTechTri`, `hrsAssistantTri` (**number**, pas du texte contrairement à `sites`)
- Index unique sur `(type_equipement1, type_equipement2, type_equipement3)`.

### `demandes_depannage` → `demandes_depannage` (pas encore migré)
`lib/features/gmao/depannage/demande_depannage_model.dart`. Alimentée par la Cloud Function publique `soumettreDemandeDepannage`.
- `equipementId`, `clientId`, `clientNom`, `clientSite`, `equipementNom`, `email`, `message`, `statut` (`'nouvelle'|'traitee'` → enum), `dateCreation` (**Timestamp**, nullable)

### `affaires` → `affaires` (pas encore migré)
`lib/features/affaires/data/affaire_model.dart`. `clientId` → `site_id` FK.
- `clientNom`, `site`, `numeroDevis`, `designationPrestations`, `emailResponsableContrat`, `numeroCommandeClient`, `nature` (code `NatureAffaire`, String, FK vers table de référence commune avec les pôles BI)
- `dateCommandeClient` (**date-string**, à convertir)
- `createdAt`/`updatedAt` (**int millisecondes epoch**, PAS un Timestamp Firestore — conversion directe `to_timestamp(ms/1000.0)`)

### `bis` → `bons_intervention` + `bi_prestations` + `bi_photos` + `bi_historique` (pas encore migré)
`lib/features/bon_intervention/data/bi_model.dart`, classe `BonIntervention`. ~54 champs top-level.
- `pole` (String, FK `natures_travaux` — même échelle de codes que `affaires.nature`, voir `bi_constants.dart`/`affaire_constants.dart` ci-dessous), `chrono` (int), `numero`, `numeroProvisoire` (bool), `statut` (`brouillon|averif|valide|pdf|prete|envoye|erreur`)
- Liens : `clientId`/`clientNom`/`site`/`adresse`/`email`/`horsContrat`, `equipementId`/`equipementNom`/`equipementGroupe`/`equipementLocalisation`, `affaireId`/`affaireNumeroDevis`/`affaireNumeroCommandeClient`/`affaireDateCommandeClient` (snapshots de libellés recopiés, pas juste des FK — à garder au moins en partie pour l'historique)
- `materielTypeEquipementId`, `materielChampsEnTete` (jsonb, mêmes clés que `equipements.champsEnTete`) — saisi en Installation neuve/Remplacement à l'identique
- `entretienGroupes` (text[]), `entretienNonDesservis` (jsonb, `[{nom, motif}]`) — Entretien sous contrat uniquement
- Dates : `dateDebut`, `dateFin`, `dateIntervention`, `dateSignature` (toutes **date-string**), `tempsPasse`, `heureDebut`, `heureFin`
- `techniciens` (text[] — noms libres aujourd'hui, idéalement FK `profiles` plus tard), `technicienSignataire`
- `compteRendu`, `obsTech`, `obsClient`, `noteInterne`
- `prestas` → table `bi_prestations` : clés Firestore **abrégées** `d` (désignation), `n` (quantité), `pu` (prix unitaire — **jamais lisible par un technicien**, colonne à masquer via vue ou policy)
- `photos` → table `bi_photos` : `type` (`avant|defaut|pendant|apres|autre`), `legende`, `horodatage`, `url` (Storage `bi_photos/...`)
- `history` → table `bi_historique` : `user`, `date`, `event`, `changes` (jsonb)
- `sigTech`/`sigClient` (base64 PNG) → fichiers dans le bucket Storage privé `bi`, seul le chemin stocké
- `signataire`, `signataireTelPortable`, `signataireTelFixe`, `numeroDevis`
- `driveBiFolderId`, `pdfDriveUrl`, `jsonDriveUrl` (archivage Drive, voir §Intégrations)
- `createdBy` (String uid → FK `profiles`), `createdAt`/`updatedAt` (**int ms epoch**)

### `chronos` → `compteurs` (pas encore migré)
`lib/features/bon_intervention/data/bi_service.dart`. Un doc par année (id = année en string), champ `BI` (int) incrémenté par transaction Firestore, partagé entre tous les pôles, remis à 1 chaque nouvelle année. → fonction SQL `prochain_chrono(cle text, annee int)` en `UPDATE ... RETURNING`, atomique.

### `compteurs/chrono_cerfa` → `compteurs` (doc unique, pas encore migré)
`lib/features/cerfa/services/firestore_service.dart`. **Path distinct de `chronos`** : collection `compteurs`, doc unique `chrono_cerfa`, champ `valeur` (int). ⚠️ Ne se réinitialise **jamais** par année dans le code (contrairement à `chronos/{année}.BI`) — seul l'affichage (`chronoStr`, 3 chiffres) préfixe l'année. `derniere_mise_a_jour` (**Timestamp**).

### `detecteurs` → `detecteurs` (pas encore migré)
`lib/features/cerfa/models/detecteur_model.dart`, value object simple (pas de `fromFirestore`/`toMap`, mapping inline dans `firestore_service.dart`).
- `reference` (String), `date_controle` (**Timestamp**) — ⚠️ seule clé Firestore en **snake_case** de tout le schéma (le reste est en camelCase), à ne pas rater lors du mapping.

### `app_config/version` → `app_config` (à garder tant que l'APK Flutter vit)
Doc unique lu par `update_service.dart`. `versionCode`, `versionName`, `downloadUrl`.

### `signalements_terrain` → `signalements_terrain` (pas encore migré)
`lib/features/signalement/signalement_model.dart`.
- `auteurId`, `auteurNom`, `chapitre`, `ecran`, `type` (`Bug|Suggestion|Remarque`), `description`, `photos` (text[]), `date` (**Timestamp**), `statut` (`nouveau|traite`)

### `techniciens`, `collaborateurs` — **ne pas migrer**
Anciennes collections déjà fusionnées dans `users`/`profiles`.

### Pas des collections Firestore (pour mémoire, ne pas créer de table)
- `CerfaData` (`lib/features/cerfa/models/cerfa_data_model.dart`) : état du formulaire CERFA en mémoire pendant la saisie (~90 champs), jamais persisté en Firestore — le résultat (PDF + JSON) part directement sur Google Drive.
- `Equipement` (`lib/features/cerfa/models/equipement_model.dart`) : lignes du Google Sheet CERFA, pas Firestore (voir note `equipements` ci-dessus).

### Règles métier par pôle/nature (`bi_constants.dart` classe `Poles` + `affaire_constants.dart` classe `NatureAffaire`) → table `natures_travaux`
Codes : `10` Installation neuve, `15` Remplacement à l'identique, `20` Entretien sous contrat, `25` Entretien hors contrat, `30` Réparation d'un équipement, `35` Réparation diverse, `40` Mise à disposition d'équipement, `50` Livraison de matériel, `60` Dépannage (pôle BI uniquement, **pas une nature d'affaire** — colonne `est_nature_affaire`).
Booléens de règles à reprendre exactement : `avec_affaire` (tous sauf `20` et `60`), `avec_periode` (`20` uniquement), `avec_equipement_obligatoire` (`15`, `30`), `avec_groupes_entretien` (`20` uniquement), `avec_equipement_optionnel` (`60`, `35`), `avec_equipement_libre` (`35` uniquement), `avec_nouvel_equipement` (`10` uniquement), `avec_temps_libre` (`30`, `35`, `60`), `sans_temps_passe` (`10`,`15`,`30`,`35`,`40`,`50`), `avec_fourniture_materiel` (`60` uniquement). Ordre d'affichage technicien : `60,15,10,30,35,20,25,40,50`.

### Calcul des heures (`calcul_heures_visite.dart`) — à porter à l'identique
Séquence de visite selon `freqEntretienAnnuelle` : 1×/an → toujours "An" ; 2×/an → 1ère "An", 2ème "Sem" ; 4×/an → "An", "Tri", "Sem", "Tri". `freqCourante` reboucle sur la séquence au-delà de la fréquence prévue (`((freqCourante-1) % freqAnnuelle) + 1`). `HeuresAnnee.prevues` = cumul de **toutes** les visites de l'année (pas juste la prochaine), `effectuees` = somme des visites 1 à `freqCourante-1`, `restantes` = `prevues - effectuees` (jamais négatif).

## 2. Conventions

- Base : `snake_case`, clés `uuid` (sauf `types_equipement.id` qui reste du texte stable), `created_at`/`updated_at` en `timestamptz` avec trigger `set_updated_at()`.
- `legacy_id text unique` sur chaque table migrée = id Firestore d'origine — sert de clé de rapprochement pour le script d'import rejouable et pour résoudre les relations (`clientId` Firestore → `sites.id` Supabase via `legacy_id`, etc.).
- RLS obligatoire sur toutes les tables. Fonctions `security definer` (`is_admin()`, à étendre en `is_staff()` pour admin+technicien) pour éviter toute récursion RLS.
- Lecture en Server Components, écriture en Server Actions (`requireAdmin()`/`requireProfile()` avant toute mutation, puis `revalidatePath()`).
- Secrets (clés API, comptes de service Google, clé secrète Supabase) : **jamais** côté client, uniquement dans des Route Handlers/Server Actions et des variables d'environnement serveur.

## 3. Rôles

- **admin** — accès complet, y compris les sections Heures & Tarifs / Contrat / Facturation / Révision (voir convention couleur verte/orange dans l'UI).
- **technicien** — accès terrain, jamais les sections admin-only, jamais les prix (`bi_prestations.pu`), jamais `releves.informations_internes`.
- **en_attente** — fiche annuaire sans compte de connexion (pas encore dotée d'un accès), déjà géré (`0003_profiles_sans_compte.sql` : `profiles.id` sans contrainte stricte vers `auth.users`).
- **client** (à venir, pas encore dans l'enum `user_role`) — accès via une future table `client_acces (profile_id, site_id)`, ne lira jamais les champs internes.

Ne jamais coder un email admin en dur (`admin@ogec.com` en Flutter, à ne pas reproduire) — le rôle vient uniquement de `profiles.role`.

## 4. Règle de bascule

Un module n'a jamais deux sources d'écriture en même temps. Tant qu'un module est saisi dans l'APK Flutter, **Firestore fait foi** et Next.js le lit via un import rejoué (script d'import, à la demande ou planifié). Le jour de la bascule d'un module : on désactive son écriture côté Flutter, on relance un dernier import, et Next.js/Supabase devient la source pour ce module.

## 5. Avancement par module

| Module | État |
|---|---|
| Répertoire | Lecture Next (sites/fournisseurs/profiles migrés et lus ; écriture pas encore portée — Flutter reste la seule écriture pour l'instant) |
| Collaborateurs/Comptes | Profils Supabase créés pour les 15 collaborateurs (10 avec compte Auth, 5 en attente) — gestion complète des comptes (création, rôle client) pas encore portée |
| GMAO (référentiel, parc, relevés) | Flutter uniquement |
| Bon d'intervention | Flutter uniquement |
| CERFA | Flutter uniquement — décision : n'utilisera plus le Google Sheet comme source, `equipements` Supabase directement |
| Affaires | Flutter uniquement |
| QR public / dépannages | Flutter uniquement (Cloud Functions) |

## 6. Format des QR codes

Aucune étiquette n'est encore posée sur le terrain — c'est le moment de fixer le format définitif, indépendant de Firebase et de l'identifiant technique.
- Colonne `equipements.code_qr text unique`, format court `OGS-000123`, attribué par une séquence Postgres à la création (et rempli aussi pour les équipements déjà importés).
- URL du QR : `{NEXT_PUBLIC_SITE_URL}/q/{code_qr}` — jamais l'ancienne URL Firebase (`https://ogec-services-app.web.app/equipement/{id}`), qui ne doit jamais être imprimée.
- Aucune redirection à prévoir depuis l'ancien domaine : aucun QR n'a encore été collé.
