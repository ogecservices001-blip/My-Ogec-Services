/// Import Firestore → Supabase, rejouable sans doublon.
///
///   npm run import:firestore -- --only=sites,fournisseurs,profiles
///   npm run import:firestore -- --dry-run
///
/// Principe : chaque ligne importée porte un `legacy_id` (id du
/// document Firestore d'origine). Le script relit d'abord la table
/// cible pour savoir quelles lignes existent déjà (legacy_id → id
/// Supabase), puis upserte sur `id` — jamais sur `legacy_id`
/// directement, pour ne jamais risquer d'écraser l'id (clé primaire,
/// référencée par les futures FK et par les comptes Auth) d'une ligne
/// existante. Une ligne jamais vue reçoit un nouvel uuid.
///
/// Pour ajouter une collection : créer scripts/mappers/<nom>.ts et
/// l'ajouter au tableau MAPPERS ci-dessous, dans l'ordre de dépendance
/// des FK (une table référencée par legacy_id doit être importée
/// avant celle qui la référence).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cert, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import type { ImportContext, Mapper, TableName } from "./mappers/types";
import { sitesMapper } from "./mappers/sites";
import { fournisseursMapper } from "./mappers/fournisseurs";
import { profilesMapper } from "./mappers/profiles";
import { typesEquipementMapper } from "./mappers/types-equipement";
import { referencesHorairesMapper } from "./mappers/references-horaires";
import { equipementsMapper } from "./mappers/equipements";
import { relevesMapper } from "./mappers/releves";
import { demandesDepannageMapper } from "./mappers/demandes-depannage";

// Ordre de dépendance des FK — sites/fournisseurs/profiles/
// types_equipement/references_horaires sont indépendants entre eux ;
// equipements référence sites et references_horaires, releves et
// demandes_depannage référencent equipements et sites (via
// `dependances`, voir mappers/types.ts) : chacun doit être importé
// après ses dépendances.
const MAPPERS: Mapper[] = [
  sitesMapper,
  fournisseursMapper,
  profilesMapper,
  typesEquipementMapper,
  referencesHorairesMapper,
  equipementsMapper,
  relevesMapper,
  demandesDepannageMapper,
];

type Bilan = {
  crees: number;
  maj: number;
  erreurs: { id: string; raison: string }[];
};

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;
  return { dryRun, only };
}

function env(nom: string): string {
  const v = process.env[nom];
  if (!v) {
    console.error(`Variable d'environnement manquante : ${nom}`);
    process.exit(1);
  }
  return v;
}

async function fetchLegacyIdMap(
  supabase: ReturnType<typeof createClient<Database>>,
  table: TableName,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from(table)
    .select("id, legacy_id")
    .not("legacy_id", "is", null)
    .returns<{ id: string; legacy_id: string | null }[]>();
  if (error) {
    throw new Error(`Impossible de lire ${table} pour résoudre les dépendances : ${error.message}`);
  }
  const map = new Map<string, string>();
  for (const row of data) {
    if (row.legacy_id) map.set(row.legacy_id, row.id);
  }
  return map;
}

async function importerCollection(
  mapper: Mapper,
  db: Firestore,
  supabase: ReturnType<typeof createClient<Database>>,
  dryRun: boolean,
): Promise<Bilan> {
  const bilan: Bilan = { crees: 0, maj: 0, erreurs: [] };
  console.log(`\n== ${mapper.name} (${mapper.collection} → ${mapper.table}) ==`);

  const snap = await db.collection(mapper.collection).get();
  console.log(`${snap.size} document(s) Firestore.`);

  const cartesDependances = new Map<TableName, Map<string, string>>();
  for (const dep of mapper.dependances ?? []) {
    cartesDependances.set(dep, await fetchLegacyIdMap(supabase, dep));
  }
  const ctx: ImportContext = {
    legacyId: (table, legacyId) =>
      legacyId ? (cartesDependances.get(table)?.get(legacyId) ?? null) : null,
  };

  const idParLegacyId = new Map<string, string>();
  const idsExistants = new Set<string>();
  if (mapper.idIsDocId) {
    const { data: existants, error } = await supabase.from(mapper.table).select("id");
    if (error) {
      console.error(`  Impossible de lire ${mapper.table} : ${error.message}`);
      bilan.erreurs.push({ id: "*", raison: error.message });
      return bilan;
    }
    for (const row of existants) idsExistants.add(row.id);
  } else {
    const { data: existants, error: errExistants } = await supabase
      .from(mapper.table)
      .select("id, legacy_id")
      .not("legacy_id", "is", null)
      .returns<{ id: string; legacy_id: string | null }[]>();
    if (errExistants) {
      console.error(`  Impossible de lire ${mapper.table} : ${errExistants.message}`);
      bilan.erreurs.push({ id: "*", raison: errExistants.message });
      return bilan;
    }
    for (const row of existants) {
      if (row.legacy_id) idParLegacyId.set(row.legacy_id, row.id);
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (const doc of snap.docs) {
    try {
      const row = mapper.toRow({ id: doc.id, data: doc.data() }, ctx);
      const id = mapper.idIsDocId ? doc.id : (idParLegacyId.get(row.legacy_id!) ?? randomUUID());
      const estNouveau = mapper.idIsDocId ? !idsExistants.has(doc.id) : !idParLegacyId.has(row.legacy_id!);
      rows.push({ ...row, id });
      if (estNouveau) bilan.crees++;
      else bilan.maj++;
    } catch (e) {
      bilan.erreurs.push({ id: doc.id, raison: (e as Error).message });
    }
  }

  if (dryRun) {
    console.log(
      `  [dry-run] ${bilan.crees} à créer, ${bilan.maj} à mettre à jour, ${bilan.erreurs.length} en erreur.`,
    );
    return bilan;
  }

  for (let i = 0; i < rows.length; i += 500) {
    const lot = rows.slice(i, i + 500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(mapper.table).upsert(lot as any, { onConflict: "id" });
    if (error) {
      console.error(`  Erreur upsert ${mapper.table} (lot ${i / 500 + 1}) : ${error.message}`);
      for (const r of lot) {
        bilan.erreurs.push({ id: String(r.legacy_id), raison: error.message });
      }
    }
  }

  console.log(`  ${bilan.crees} créé(s), ${bilan.maj} mis à jour, ${bilan.erreurs.length} erreur(s).`);
  return bilan;
}

async function main() {
  const { dryRun, only } = parseArgs();

  const serviceAccountPath = env("FIREBASE_SERVICE_ACCOUNT_PATH");
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseSecret = env("SUPABASE_SECRET_KEY");

  const serviceAccount = JSON.parse(
    readFileSync(path.resolve(serviceAccountPath), "utf8"),
  ) as ServiceAccount;
  const app = initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore(app);
  const supabase = createClient<Database>(supabaseUrl, supabaseSecret);

  const mappersARetenir = only ? MAPPERS.filter((m) => only.includes(m.name)) : MAPPERS;
  if (mappersARetenir.length === 0) {
    console.error(
      `Aucun mapper pour --only=${only?.join(",")}. Disponibles : ${MAPPERS.map((m) => m.name).join(", ")}`,
    );
    process.exit(1);
  }

  const bilanGlobal: Record<string, Bilan> = {};
  for (const mapper of mappersARetenir) {
    bilanGlobal[mapper.name] = await importerCollection(mapper, db, supabase, dryRun);
  }

  console.log("\n===== Bilan =====");
  let totalErreurs = 0;
  for (const [nom, b] of Object.entries(bilanGlobal)) {
    console.log(`${nom} : ${b.crees} créé(s), ${b.maj} mis à jour, ${b.erreurs.length} erreur(s)`);
    for (const e of b.erreurs) {
      console.log(`  - ${e.id} : ${e.raison}`);
      totalErreurs++;
    }
  }

  process.exit(totalErreurs > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
