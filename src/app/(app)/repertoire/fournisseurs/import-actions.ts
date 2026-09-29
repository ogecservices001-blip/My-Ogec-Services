"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { fournisseurSchema, type FournisseurInput } from "@/lib/validation/fournisseur";
import type { ActionResult } from "@/lib/action-result";

export type LigneDiffFournisseur = {
  donnees: FournisseurInput;
  statut: "ajout" | "modification";
  fournisseurExistantId?: string;
  differences: [string, string, string][];
};

export type ResultatPreviewFournisseurs =
  | { ok: true; lignes: LigneDiffFournisseur[]; avertissements: string[] }
  | { ok: false; erreur: string };

const CHAMPS: (keyof FournisseurInput)[] = [
  "nom",
  "denomination_courte",
  "interlocuteurs",
  "tel",
  "portable",
  "courriel",
  "site_web",
  "commune",
  "code_postal",
  "adresse",
  "complement_adresse",
  "produits_cles",
  "remarques",
];

const LABELS: Record<keyof FournisseurInput, string> = {
  nom: "Nom",
  denomination_courte: "Dénomination courte",
  interlocuteurs: "Interlocuteurs",
  tel: "Tél fixe",
  portable: "Portable",
  courriel: "Courriel",
  site_web: "Site web",
  commune: "Commune",
  code_postal: "Code postal",
  adresse: "Adresse",
  complement_adresse: "Complément d'adresse",
  produits_cles: "Produits clés",
  remarques: "Remarques",
};

/// CSV (point-virgule ou virgule), 12 colonnes minimum (13ᵉ =
/// remarques, optionnelle) — même format que l'import Flutter.
/// Rapprochement par nom exact.
export async function previsualiserImportFournisseurs(
  formData: FormData,
): Promise<ResultatPreviewFournisseurs> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Aucun fichier sélectionné." };
  }

  let texte: string;
  try {
    texte = await fichier.text();
  } catch {
    return { ok: false, erreur: "Fichier illisible." };
  }

  const supabase = await createClient();
  const { data: existants, error } = await supabase.from("fournisseurs").select("*");
  if (error) return { ok: false, erreur: error.message };
  const parNom = new Map((existants ?? []).map((f) => [f.nom.trim().toLowerCase(), f]));

  const lignesBrutes = texte.split(/\r?\n/);
  const lignes: LigneDiffFournisseur[] = [];
  const avertissements: string[] = [];
  const vus = new Set<string>();

  for (let i = 1; i < lignesBrutes.length; i++) {
    const ligne = lignesBrutes[i].trim();
    if (!ligne) continue;

    const separateur = ligne.includes(";") ? ";" : ",";
    const valeurs = ligne.split(separateur).map((v) => v.trim());
    if (valeurs.length < 12) {
      avertissements.push(
        `Ligne ${i + 1} ignorée : ${valeurs.length} colonne(s) trouvée(s) (12 minimum).`,
      );
      continue;
    }

    const nom = valeurs[0];
    if (!nom) {
      avertissements.push(`Ligne ${i + 1} ignorée : nom vide.`);
      continue;
    }
    const cleNom = nom.toLowerCase();
    if (vus.has(cleNom)) {
      avertissements.push(`"${nom}" en double dans le fichier — seule la première occurrence est prise en compte.`);
      continue;
    }
    vus.add(cleNom);

    const brut = {
      nom,
      denomination_courte: valeurs[1] ?? "",
      interlocuteurs: valeurs[2] ?? "",
      tel: valeurs[3] ?? "",
      portable: valeurs[4] ?? "",
      courriel: valeurs[5] ?? "",
      site_web: valeurs[6] ?? "",
      commune: valeurs[7] ?? "",
      code_postal: valeurs[8] ?? "",
      adresse: valeurs[9] ?? "",
      complement_adresse: valeurs[10] ?? "",
      produits_cles: valeurs[11] ?? "",
      remarques: valeurs[12] ?? "",
    };
    const parsed = fournisseurSchema.safeParse(brut);
    if (!parsed.success) {
      avertissements.push(`Ligne ${i + 1} ("${nom}") ignorée : ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const donnees = parsed.data;

    const existant = parNom.get(cleNom);
    if (!existant) {
      lignes.push({ donnees, statut: "ajout", differences: [] });
      continue;
    }

    const differences: [string, string, string][] = [];
    for (const champ of CHAMPS) {
      const nouvelle = donnees[champ];
      const ancienne = String(existant[champ as keyof typeof existant] ?? "");
      if (nouvelle && nouvelle !== ancienne) differences.push([LABELS[champ], ancienne, nouvelle]);
    }
    if (differences.length > 0) {
      lignes.push({ donnees, statut: "modification", fournisseurExistantId: existant.id, differences });
    }
  }

  return { ok: true, lignes, avertissements };
}

export async function appliquerImportFournisseurs(
  lignes: LigneDiffFournisseur[],
): Promise<ActionResult & { ajoutes?: number; modifies?: number }> {
  await requireAdmin();

  const supabase = await createClient();
  let ajoutes = 0;
  let modifies = 0;

  const aInserer = lignes.filter((l) => l.statut === "ajout").map((l) => l.donnees);
  if (aInserer.length > 0) {
    const { error } = await supabase.from("fournisseurs").insert(aInserer);
    if (error) return { ok: false, erreur: error.message };
    ajoutes = aInserer.length;
  }

  for (const ligne of lignes) {
    if (ligne.statut !== "modification" || !ligne.fournisseurExistantId) continue;
    const { error } = await supabase
      .from("fournisseurs")
      .update(ligne.donnees)
      .eq("id", ligne.fournisseurExistantId);
    if (error) return { ok: false, erreur: error.message };
    modifies++;
  }

  revalidatePath("/repertoire/fournisseurs");
  return { ok: true, ajoutes, modifies };
}
