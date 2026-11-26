import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, type PDFForm } from "pdf-lib";
import { ATTESTATION_NO, OPERATEUR, QUALITE_OPERATEUR, estInflammable } from "./regles";
import { casesPeriodicite, quantiteChargee, quantiteRecuperee } from "./calculs";
import type { CerfaPdfEntree } from "./types";

let modeleCache: Buffer | null = null;
async function modele(): Promise<Buffer> {
  if (!modeleCache) modeleCache = await readFile(path.join(process.cwd(), "public", "cerfa-15497-modele.pdf"));
  return modeleCache;
}

/// Les champs du PDF utilisent la police standard (WinAnsi) : tout caractère
/// hors de ce jeu ferait échouer l'écriture, il est remplacé.
function ansi(texte: string): string {
  return texte
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[^\n\r\t\x20-\x7E -ÿ€]/g, "");
}

function ecrire(form: PDFForm, nom: string, valeur: string) {
  try {
    form.getTextField(nom).setText(ansi(valeur ?? ""));
  } catch {
    // Champ absent d'une autre version du modèle : ignoré, comme l'ancienne appli.
  }
}

function cocher(form: PDFForm, nom: string, valeur: boolean) {
  try {
    const c = form.getCheckBox(nom);
    if (valeur) c.check();
    else c.uncheck();
  } catch {
    // idem
  }
}

/// Remplit le modèle CERFA 15497*04 — mêmes champs que PdfService
/// (Flutter) — et appose les deux signatures dans la case « Date et
/// signature », à droite de la date.
export async function genererPdfCerfa(e: CerfaPdfEntree): Promise<Buffer> {
  const doc = await PDFDocument.load(await modele());
  const form = doc.getForm();
  const d = e.donnees;
  const [jour = "", mois = "", annee = ""] = d.detecteurDateControle.split("/");
  const fuites = d.fuiteConstatee ? d.fuites : [];
  const inflammable = estInflammable(d.equipementFluide);

  const textes: Record<string, string> = {
    Fiche_no: e.ficheNo,
    Operateur: OPERATEUR,
    Attestation_no: ATTESTATION_NO,
    Detenteur: e.detenteur,
    Equipement_ID: e.equipementId,
    Equipement_Fluide: d.equipementFluide,
    Equipement_Charge: d.equipementCharge,
    Equipement_teqCO2: d.equipementTeqCO2,
    Autre: d.caseAutre ? d.autreTexte : "",
    Detecteur_ID: d.detecteurReference,
    Controle_Jour: jour,
    Controle_Mois: mois,
    Controle_Annee: annee,
    Fuite_Loca_1: fuites[0]?.localisation ?? "",
    Fuite_Loca_2: fuites[1]?.localisation ?? "",
    Fuite_Loca_3: fuites[2]?.localisation ?? "",
    "11_Quantite": quantiteChargee(d),
    "11_QA": d.qa,
    "11_Denom": d.denom,
    "11_QB": d.qb,
    "11_QC": d.qc,
    "11_QDE": quantiteRecuperee(d),
    "11_QD": d.qd,
    "11_BSFF": d.bsff,
    "11_QE": d.qe,
    "11_Contenant_ID": d.contenantId,
    "Autre-FF-NON-inflammable": "",
    "Autre-FF-inflammable": "",
    "13_Instal": "",
    "14_Observations": d.observations,
    Sign_Operateur_Nom: e.operateurNom,
    Sign_Operateur_Qualite: QUALITE_OPERATEUR,
    Sign_Operateur_Date: e.dateSignature,
    Sign_Detenteur_Nom: e.signataire.nom,
    Sign_Detenteur_Qualite: e.signataire.qualite,
    Sign_Detenteur_Date: e.dateSignature,
  };
  for (const [nom, valeur] of Object.entries(textes)) ecrire(form, nom, valeur);

  const p = casesPeriodicite(d.equipementFluide, d.equipementCharge, d.systemePermanent);
  const cases: Record<string, boolean> = {
    Case_Assemblage: d.caseAssemblage,
    Case_MiseService: d.caseMiseService,
    Case_Modif: d.caseModif,
    Case_Maintenance: d.caseMaintenance,
    Case_CtrlPerio: d.caseCtrlPerio,
    Case_CtrlNonPerio: d.caseCtrlNonPerio,
    Case_Demantel: d.caseDemantel,
    Case_Autre: d.caseAutre,
    ...p,
    Case_Fuite_Oui: d.fuiteConstatee,
    Case_Fuite_Non: !d.fuiteConstatee,
    Case_Rep_Fuite1_realisee: !!fuites[0]?.realisee,
    Case_Rep_Fuite1_AFaire: !!fuites[0]?.aFaire,
    Case_Rep_Fuite2_realisee: !!fuites[1]?.realisee,
    Case_Rep_Fuite2_AFaire: !!fuites[1]?.aFaire,
    Case_Rep_Fuite3_realisee: !!fuites[2]?.realisee,
    Case_Rep_Fuite3_AFaire: !!fuites[2]?.aFaire,
    Case_12_UN1078: !!d.equipementFluide && !inflammable,
    Case_12_UN3161: inflammable,
  };
  for (const [nom, valeur] of Object.entries(cases)) cocher(form, nom, valeur);

  try {
    form.getRadioGroup("Bouton_Oui").select(d.systemePermanent ? "1" : "2");
  } catch {
    // idem
  }

  for (const [nomChamp, png] of [
    ["Sign_Operateur_Date", e.signatureOperateurPng],
    ["Sign_Detenteur_Date", e.signatureDetenteurPng],
  ] as const) {
    if (!png) continue;
    try {
      const r = form.getTextField(nomChamp).acroField.getWidgets()[0].getRectangle();
      const image = await doc.embedPng(png);
      const decalageDate = 60;
      const marge = 2;
      const largeurMax = Math.max(10, r.width - decalageDate - marge * 2);
      const hauteurMax = Math.max(10, r.height - marge * 2);
      const echelle = Math.min(largeurMax / image.width, hauteurMax / image.height);
      doc.getPages()[0].drawImage(image, {
        x: r.x + decalageDate,
        y: r.y + marge,
        width: image.width * echelle,
        height: image.height * echelle,
      });
    } catch {
      // Signature illisible : le PDF reste valable avec les noms et la date.
    }
  }

  return Buffer.from(await doc.save());
}
