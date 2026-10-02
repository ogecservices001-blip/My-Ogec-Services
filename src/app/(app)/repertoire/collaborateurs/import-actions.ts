"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { profilSchema, type ProfilInput } from "@/lib/validation/profil";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffProfil = {
  donnees: ProfilInput;
  mdp: string;
  statut: "ajout" | "modification";
  profilExistantId?: string;
  differences: [string, string, string][];
};

export type ResultatPreviewProfils =
  | { ok: true; lignes: LigneDiffProfil[]; avertissements: string[] }
  | { ok: false; erreur: string };

const LABELS: Record<keyof ProfilInput, string> = {
  name: "Nom",
  qualite: "Qualité",
  portable: "Portable",
  email_pro: "Email pro",
  email_perso: "Email personnel",
  commune_habitation: "Commune",
  vehicule: "Véhicule",
};

// En-têtes reconnus (insensible à la casse/accents simples) — associe
// une colonne du fichier à un champ de ProfilInput. Toute colonne non
// reconnue (ex. "Email récupération") est simplement ignorée, ce qui
// permet de réimporter directement le classeur maître du bureau
// (plus riche que notre propre export) sans adaptation.
const EN_TETES_CONNUS: Record<string, keyof ProfilInput> = {
  nom: "name",
  qualite: "qualite",
  qualité: "qualite",
  portable: "portable",
  "email pro": "email_pro",
  "email personnel": "email_perso",
  commune: "commune_habitation",
  vehicule: "vehicule",
  véhicule: "vehicule",
};

function normaliser(s: string): string {
  return s.trim().toLowerCase();
}

/// Lit le fichier Excel envoyé, extrait la première feuille et calcule
/// le diff par rapport aux profils déjà en base, rapprochés par nom
/// exact — jamais écrit en base ici, juste un aperçu pour validation.
/// Le rôle n'est jamais importé directement : il reste celui déjà en
/// base (modifiable via la fiche d'un collaborateur, déduit de sa
/// qualité). Une colonne de mot de passe ("mdp") est reconnue à part —
/// stockée séparément (jamais sur "profiles"), avec un avertissement
/// pour rappeler qu'elle n'est jamais appliquée automatiquement sur le
/// compte Supabase Auth.
export async function previsualiserImportProfils(
  formData: FormData,
): Promise<ResultatPreviewProfils> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await fichier.arrayBuffer());
  } catch {
    return { ok: false, erreur: "Fichier illisible — un .xlsx/.xlsm est attendu." };
  }

  const feuille = workbook.getWorksheet("COLLABORATEURS") ?? workbook.worksheets[0];
  if (!feuille) {
    return { ok: false, erreur: "Feuille introuvable dans ce classeur." };
  }

  const ligneEntetes = feuille.getRow(1);
  const indexParChamp = new Map<keyof ProfilInput, number>();
  let indexMdp: number | null = null;
  ligneEntetes.eachCell((cellule, index0Based) => {
    const texte = normaliser(String(cellule.value ?? ""));
    const champ = EN_TETES_CONNUS[texte];
    if (champ) indexParChamp.set(champ, index0Based - 1); // exceljs 1-based
    else if (texte.includes("mdp")) indexMdp = index0Based - 1;
  });
  if (!indexParChamp.has("name")) {
    return { ok: false, erreur: 'Colonne "Nom" introuvable — en-têtes de colonnes attendues en première ligne.' };
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("profiles").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNom = new Map((existants ?? []).map((p) => [p.name.trim().toLowerCase(), p]));

  const lignes: LigneDiffProfil[] = [];
  const avertissements: string[] = [];
  const vus = new Set<string>();

  feuille.eachRow((row, numeroLigne) => {
    if (numeroLigne === 1) return; // en-tête

    const valeur = (index0: number): string => {
      const cellule = row.getCell(index0 + 1); // exceljs 1-based
      const v = cellule.value;
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "").trim();
      return String(v).trim();
    };

    const nom = valeur(indexParChamp.get("name")!);
    if (!nom) return;
    const cleNom = nom.toLowerCase();
    if (vus.has(cleNom)) {
      avertissements.push(`"${nom}" en double dans le fichier — seule la première occurrence est prise en compte.`);
      return;
    }
    vus.add(cleNom);

    const brut: Record<string, string> = {};
    for (const [champ, index0] of indexParChamp) brut[champ] = valeur(index0);
    const parsed = profilSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(`Ligne ${numeroLigne} ("${nom}") ignorée : ${parsed.error.issues[0]?.message}`);
      return;
    }
    const donnees = parsed.data;
    const mdp = indexMdp !== null ? valeur(indexMdp) : "";
    if (mdp) {
      avertissements.push(
        `⚠️ Mot de passe fourni pour "${nom}" — enregistré pour référence, pense à l'appliquer toi-même sur son compte (pas d'application automatique).`,
      );
    }

    const existant = parNom.get(cleNom);
    if (!existant) {
      lignes.push({ donnees, mdp, statut: "ajout", differences: [] });
      return;
    }

    const differences: [string, string, string][] = [];
    for (const champ of indexParChamp.keys()) {
      const nouvelle = donnees[champ];
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) differences.push([LABELS[champ], ancienne, nouvelle]);
    }
    if (differences.length > 0 || mdp) {
      lignes.push({ donnees, mdp, statut: "modification", profilExistantId: existant.id, differences });
    }
  });

  return { ok: true, lignes, avertissements };
}

export async function appliquerImportProfils(
  lignes: LigneDiffProfil[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes
    .filter((l) => l.statut === "ajout")
    .map((l) => ({ ...l.donnees, id: crypto.randomUUID(), role: "en_attente" as const }));
  if (aInserer.length > 0) {
    const { error } = await supabase.from("profiles").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }
  const idParNomInsere = new Map(aInserer.map((p) => [p.name.trim().toLowerCase(), p.id]));

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.profilExistantId) continue;
    const { error } = await supabase
      .from("profiles")
      .update(ligne.donnees)
      .eq("id", ligne.profilExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  const mdpAEnregistrer = lignes
    .filter((l) => l.mdp)
    .map((l) => ({
      profil_id: l.profilExistantId ?? idParNomInsere.get(l.donnees.name.trim().toLowerCase()),
      mdp_app: l.mdp,
    }))
    .filter((l): l is { profil_id: string; mdp_app: string } => Boolean(l.profil_id));
  if (mdpAEnregistrer.length > 0) {
    const { error } = await supabase.from("profils_mdp").upsert(mdpAEnregistrer, { onConflict: "profil_id" });
    if (error) return { ok: false, erreur: error.message };
  }

  revalidatePath("/repertoire/collaborateurs");
  return { ok: true, ajoutes, modifies };
}
