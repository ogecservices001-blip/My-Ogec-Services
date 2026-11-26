"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import type { ChampsEnTeteEquipement } from "@/lib/gmao/types";
import {
  FAMILLES_CERFA,
  ajouterMois,
  cleReference,
  dateFr,
  ficheNo as formatFicheNo,
  fluideGmao,
  numeroBordereau,
  classement,
  teqCO2,
  texteChamp,
} from "@/lib/cerfa/regles";
import { natureRenseignee, quantitesDeclaration } from "@/lib/cerfa/calculs";
import { genererPdfCerfa } from "@/lib/cerfa/pdf";
import { envoyerCerfaEmail, envoyerRecapCerfa } from "@/lib/cerfa/email";
import type { CerfaDonnees, SignataireCerfa } from "@/lib/cerfa/types";

export type EquipementCerfa = {
  id: string;
  nom: string;
  numero_equipement: string;
  localisation: string;
  type_equipement_id: string;
  champs_en_tete: ChampsEnTeteEquipement;
};

export async function chargerEquipementsCerfa(siteId: string): Promise<EquipementCerfa[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipements")
    .select("id, nom, numero_equipement, localisation, type_equipement_id, champs_en_tete")
    .eq("site_id", siteId)
    .in("type_equipement_id", FAMILLES_CERFA)
    .order("numero_equipement");
  return (data ?? []) as EquipementCerfa[];
}

export type CerfaResume = {
  id: string;
  numero: string;
  fiche_no: string;
  date_controle: string;
  operateur_nom: string;
  signataire_nom: string;
  signataire_email: string;
  envoye_le: string | null;
  envoye_a: string;
};

export async function chargerCerfasEquipement(equipementId: string): Promise<CerfaResume[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("cerfas")
    .select("id, numero, fiche_no, date_controle, operateur_nom, signataire_nom, signataire_email, envoye_le, envoye_a")
    .eq("equipement_id", equipementId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type Detecteur = { id: string; reference: string; date_controle: string };

export async function chargerDetecteurs(): Promise<Detecteur[]> {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("cerfa_detecteurs").select("id, reference, date_controle").order("reference");
  return data ?? [];
}

export async function ajouterDetecteur(reference: string, dateControleIso: string): Promise<ActionResult> {
  await requireProfile();
  if (!reference.trim()) return { ok: false, erreur: "Indique la référence du détecteur." };
  if (!dateControleIso) return { ok: false, erreur: "Indique la date de contrôle du détecteur." };
  const supabase = await createClient();
  const { error } = await supabase.from("cerfa_detecteurs").insert({ reference: reference.trim(), date_controle: dateControleIso });
  return error ? { ok: false, erreur: error.message } : { ok: true };
}

export async function supprimerDetecteur(id: string): Promise<ActionResult> {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("cerfa_detecteurs").delete().eq("id", id);
  return error ? { ok: false, erreur: error.message } : { ok: true };
}

export type FinalisationCerfa = {
  equipementId: string;
  donnees: CerfaDonnees;
  operateurNom: string;
  signataire: SignataireCerfa;
  nouveauSignataire: boolean;
  signatureOperateur: string;
  signatureDetenteur: string;
};

function pngDepuisDataUrl(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  return m ? new Uint8Array(Buffer.from(m[1], "base64")) : null;
}

function segment(s: string): string {
  return s.replace(/[/\\]/g, "-").trim() || "-";
}

/// Validation de l'étape 5 (portage de FormSignatureScreen._onValider) :
/// n° attribué seulement ici, PDF rempli et archivé, équipement mis à jour
/// comme l'était la ligne du Google Sheet.
export async function finaliserCerfa(
  f: FinalisationCerfa,
): Promise<ActionResult & { id?: string; numero?: string; ficheNo?: string; emailClient?: string; avertissement?: string }> {
  const profile = await requireProfile();
  const d = f.donnees;
  if (!f.operateurNom.trim()) return { ok: false, erreur: "Renseigne ton nom (technicien)." };
  if (!f.signataire.nom.trim()) return { ok: false, erreur: "Renseigne le nom du signataire." };
  if (!natureRenseignee(d)) return { ok: false, erreur: "Coche au moins une nature d'intervention." };
  const sigOp = pngDepuisDataUrl(f.signatureOperateur);
  const sigDet = pngDepuisDataUrl(f.signatureDetenteur);
  if (!sigOp || !sigDet) return { ok: false, erreur: "Les deux signatures sont obligatoires." };

  const supabase = await createClient();
  const { data: eq } = await supabase
    .from("equipements")
    .select("id, nom, localisation, type_equipement_id, champs_en_tete, site_id")
    .eq("id", f.equipementId)
    .single();
  if (!eq) return { ok: false, erreur: "Équipement introuvable." };
  const { data: site } = await supabase
    .from("sites")
    .select("id, nom, site, n_affaire, adresse, complement_adresse, code_postal, commune")
    .eq("id", eq.site_id)
    .single();
  if (!site) return { ok: false, erreur: "Site introuvable." };

  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const { data: chrono, error: errChrono } = await supabase.rpc("cerfa_prochain_chrono", { p_annee: annee });
  if (errChrono || !chrono) return { ok: false, erreur: errChrono?.message ?? "Numéro CERFA non attribué." };

  const numero = numeroBordereau(annee, chrono, site.n_affaire, eq.nom);
  const fiche = formatFicheNo(annee, chrono);
  const aujourdhui = dateFr(maintenant);
  const prochain = ajouterMois(maintenant, classement(d.equipementFluide, d.equipementCharge, d.systemePermanent).mois);
  const donnees: CerfaDonnees = { ...d, equipementTeqCO2: teqCO2(d.equipementFluide, d.equipementCharge) };
  const ligne3 = site.complement_adresse ? site.complement_adresse : `${site.code_postal} - ${site.commune}`;

  const pdf = await genererPdfCerfa({
    ficheNo: fiche,
    detenteur: `${site.nom} ${site.site}\n${site.adresse}\n${ligne3}`,
    equipementId: eq.nom,
    donnees,
    operateurNom: f.operateurNom.trim(),
    signataire: f.signataire,
    dateSignature: aujourdhui,
    signatureOperateurPng: sigOp,
    signatureDetenteurPng: sigDet,
  });

  const chemin = `${segment(`${site.n_affaire} ${site.nom} — ${site.site}`)}/${annee}/${segment(numero)}.pdf`;
  const { error: errPdf } = await supabase.storage.from("cerfa-archives").upload(chemin, pdf, { contentType: "application/pdf" });
  if (errPdf) return { ok: false, erreur: `PDF non archivé : ${errPdf.message}` };

  const q = quantitesDeclaration(donnees);
  const { data: cree, error: errCerfa } = await supabase
    .from("cerfas")
    .insert({
      equipement_id: eq.id,
      site_id: site.id,
      annee,
      chrono,
      fiche_no: fiche,
      numero,
      client_nom: site.nom,
      site_nom: site.site,
      n_affaire: site.n_affaire,
      equipement_nom: eq.nom,
      donnees,
      date_controle: maintenant.toISOString().slice(0, 10),
      date_prochain_controle: `${prochain.getFullYear()}-${String(prochain.getMonth() + 1).padStart(2, "0")}-${String(prochain.getDate()).padStart(2, "0")}`,
      operateur_nom: f.operateurNom.trim(),
      signataire_nom: f.signataire.nom.trim(),
      signataire_qualite: f.signataire.qualite.trim(),
      signataire_email: f.signataire.email.trim(),
      qte_chargees_neufs: q.qteChargeesNeufs,
      qte_chargees_maintenance: q.qteChargeesMaintenance,
      qte_recup_maintenance: q.qteRecupMaintenance,
      qte_recup_hors_usage: q.qteRecupHorsUsage,
      pdf_path: chemin,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (errCerfa || !cree) return { ok: false, erreur: errCerfa?.message ?? "CERFA non enregistré." };

  // Fiche équipement : les champs vides sont complétés, le suivi
  // d'étanchéité toujours mis à jour (ancienne mise à jour du Sheet).
  let avertissement: string | undefined;
  const champs = { ...((eq.champs_en_tete ?? {}) as ChampsEnTeteEquipement) };
  const completer = (cle: string, valeur: string) => {
    if (valeur.trim() && !texteChamp(champs, cle).trim()) champs[cle] = valeur.trim();
  };
  completer("marque", d.equipementMarque);
  completer("dateMES", d.equipementDateMES);
  completer(cleReference(eq.type_equipement_id), d.equipementReference);
  completer("typeRefrigerant", fluideGmao(d.equipementFluide));
  completer("chargeRefrigerant", d.equipementCharge);
  champs.dateDernierControle = aujourdhui;
  champs.dateProchainControle = dateFr(prochain);
  champs.numDernierBordereau = numero;
  const localisation = eq.localisation?.trim() ? eq.localisation : d.equipementLocalisation.trim();
  const { error: errEq } = await supabase
    .from("equipements")
    .update({ champs_en_tete: champs, localisation })
    .eq("id", eq.id);
  if (errEq) avertissement = `Fiche équipement non mise à jour (${errEq.message}) — le CERFA est bien enregistré.`;

  if (f.nouveauSignataire) {
    const { data: place } = await supabase.rpc("cerfa_ajouter_signataire", {
      p_site: site.id,
      p_nom: f.signataire.nom.trim(),
      p_qualite: f.signataire.qualite.trim(),
      p_email: f.signataire.email.trim(),
    });
    if (!place) avertissement = [avertissement, "Les 4 interlocuteurs du site sont déjà pris : le nouveau signataire n'a pas été ajouté au site."].filter(Boolean).join(" ");
  }

  revalidatePath("/cerfa");
  return { ok: true, id: cree.id, numero, ficheNo: fiche, emailClient: f.signataire.email.trim(), avertissement };
}

async function pdfDuCerfa(id: string) {
  const supabase = await createClient();
  const { data: c } = await supabase.from("cerfas").select("id, numero, pdf_path, site_nom, equipement_nom").eq("id", id).single();
  if (!c?.pdf_path) return null;
  const { data } = await supabase.storage.from("cerfa-archives").download(c.pdf_path);
  if (!data) return null;
  return { cerfa: c, pdf: Buffer.from(await data.arrayBuffer()) };
}

export async function envoyerCerfaParEmail(id: string, destinataires: string[]): Promise<ActionResult> {
  await requireProfile();
  const liste = destinataires.map((s) => s.trim()).filter(Boolean);
  if (liste.length === 0) return { ok: false, erreur: "Indique au moins une adresse email destinataire." };
  const r = await pdfDuCerfa(id);
  if (!r) return { ok: false, erreur: "PDF du CERFA introuvable." };
  try {
    await envoyerCerfaEmail({
      destinataires: liste,
      site: r.cerfa.site_nom,
      equipement: r.cerfa.equipement_nom,
      numero: r.cerfa.numero,
      nomFichier: `${segment(r.cerfa.numero)}.pdf`,
      pdf: r.pdf,
    });
  } catch (e) {
    return { ok: false, erreur: `Échec de l'envoi : ${e instanceof Error ? e.message : String(e)}` };
  }
  const supabase = await createClient();
  await supabase.from("cerfas").update({ envoye_le: new Date().toISOString(), envoye_a: liste.join(", ") }).eq("id", id);
  revalidatePath("/cerfa");
  return { ok: true };
}

export async function envoyerRecapPoint(destinataire: string, objet: string, corps: string): Promise<ActionResult> {
  await requireAdmin();
  if (!destinataire.trim()) return { ok: false, erreur: "Indique l'adresse destinataire." };
  try {
    await envoyerRecapCerfa({ destinataire: destinataire.trim(), objet, corps });
    return { ok: true };
  } catch (e) {
    return { ok: false, erreur: `Échec de l'envoi : ${e instanceof Error ? e.message : String(e)}` };
  }
}
