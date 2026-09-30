import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/lib/types";
import { Statuts, labelPole } from "./constants";
import { currentYear } from "./format";
import { genererPdfBI, type PhotoAnnexe } from "./pdf";

type Bon = Tables<"bons_intervention">;

function segment(s: string): string {
  return s.replace(/[/\\]/g, "-").trim() || "—";
}

/// Arborescence d'archive — même structure que l'archivage Drive
/// d'origine (Client — Site / Pôle / Année / BI / N°), mais dans le
/// bucket Storage privé `bi-archives` plutôt que sur un Drive Google
/// (décision explicite de l'utilisateur : pas de flux OAuth admin à
/// construire pour ce seul besoin).
function dossierArchive(bon: Bon): string {
  const client = segment(bon.site ? `${bon.client_nom} — ${bon.site}` : bon.client_nom);
  const pole = segment(`${bon.pole} - ${labelPole(bon.pole)}`);
  return `${client}/${pole}/${currentYear()}/BI/${segment(bon.numero)}`;
}

/// Régénère le PDF depuis les données actuelles du bon, en allant
/// rechercher les octets des photos dans le bucket `bi-photos` — même
/// principe que l'original Flutter ("rien n'est stocké, tout est
/// régénéré à la consultation").
export async function genererPdfAvecPhotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bon: Bon,
): Promise<Buffer> {
  const photosBrutes = bon.photos as unknown as { type: string; storage_path: string; horodatage: string }[];
  const photos: PhotoAnnexe[] = [];
  for (const p of photosBrutes.slice(0, 4)) {
    if (!p.storage_path) continue;
    const { data } = await supabase.storage.from("bi-photos").download(p.storage_path);
    if (!data) continue;
    photos.push({ type: p.type, legende: "", horodatage: p.horodatage, bytes: Buffer.from(await data.arrayBuffer()) });
  }
  return genererPdfBI(bon, photos);
}

/// Génère le PDF et l'archive dans Storage si ce n'est pas déjà fait —
/// appelée à la validation bureau, jamais bloquante pour la validation
/// elle-même (voir l'appel dans validerBI, encadré d'un try/catch).
export async function archiverBiSiBesoin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  bon: Bon,
): Promise<void> {
  if (bon.pdf_storage_path) return;

  const pdfBytes = await genererPdfAvecPhotos(supabase, bon);
  const jsonBytes = Buffer.from(JSON.stringify(bon, null, 2));

  const dossier = dossierArchive(bon);
  const pdfPath = `${dossier}/${segment(bon.numero)}.pdf`;
  const jsonPath = `${dossier}/donnees_${segment(bon.numero)}.json`;

  const [{ error: errPdf }, { error: errJson }] = await Promise.all([
    supabase.storage.from("bi-archives").upload(pdfPath, pdfBytes, { contentType: "application/pdf" }),
    supabase.storage.from("bi-archives").upload(jsonPath, jsonBytes, { contentType: "application/json" }),
  ]);
  if (errPdf || errJson) throw errPdf ?? errJson;

  await supabase
    .from("bons_intervention")
    .update({ pdf_storage_path: pdfPath, json_storage_path: jsonPath, statut: Statuts.pretEnvoi })
    .eq("id", bon.id);
}
