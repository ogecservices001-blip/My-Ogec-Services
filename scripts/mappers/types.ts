import type { Database } from "../../src/lib/database.types";

/// Nom d'une table Postgres connue des types générés — un mapper ne
/// peut cibler qu'une table qui existe déjà dans le schéma.
export type TableName = keyof Database["public"]["Tables"];

/// Un document Firestore générique passé à un mapper : id du document
/// (= futur legacy_id) et ses champs bruts, tels que renvoyés par
/// `doc.data()` (types non garantis, à convertir explicitement dans
/// chaque mapper).
export type FirestoreDoc = {
  id: string;
  data: Record<string, unknown>;
};

/// Donné à `toRow` pour résoudre une relation Firestore (ex: `clientId`)
/// vers l'id Supabase de la table déjà importée correspondante, via son
/// `legacy_id`. `null` si la table n'a pas été pré-chargée (absente de
/// `Mapper.dependances`) ou si l'id Firestore est introuvable.
export type ImportContext = {
  legacyId: (table: TableName, legacyId: string | null | undefined) => string | null;
};

/// Un mapper transforme un document d'une collection Firestore en une
/// ligne Postgres prête à upserter. `toRow` ne renvoie jamais `id` (la
/// résolution id existant/nouveau est faite par le moteur d'import,
/// via `legacy_id`) — juste `legacy_id` et les colonnes métier.
export type Mapper = {
  /// Nom court utilisé pour --only=... et dans les logs (ex: "sites").
  name: string;
  /// Table Postgres cible.
  table: TableName;
  /// Collection Firestore source.
  collection: string;
  /// true si l'id Postgres doit être l'id du document Firestore tel
  /// quel (clé naturelle déjà stable, ex: types_equipement/mod_roof) —
  /// pas de legacy_id ni d'uuid généré dans ce cas.
  idIsDocId?: boolean;
  /// Tables dont la map legacy_id→id doit être pré-chargée avant
  /// d'importer cette collection, pour résoudre ses relations via
  /// `ImportContext.legacyId` (ex: equipements a besoin de sites pour
  /// résoudre clientId → site_id).
  dependances?: TableName[];
  toRow: (
    doc: FirestoreDoc,
    ctx: ImportContext,
  ) => Record<string, unknown> & { legacy_id?: string };
};

/// Lit un champ texte, jamais `undefined`/`null` — les 66 champs de
/// `sites` et les 13 de `fournisseurs` sont NOT NULL avec un défaut ''
/// côté Postgres, comme ils l'étaient en String côté Flutter.
export function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return v === null || v === undefined ? "" : String(v);
}
