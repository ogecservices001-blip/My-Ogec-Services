import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/// PDF « Bon pour accord » signé en ligne par le client depuis Mon contrat
/// OGEC : rangé avec les commandes client du devis.
export async function genererBonPourAccord(p: {
  numeroDevis: string;
  objet: string;
  dateDevis: string;
  client: string;
  site: string;
  nom: string;
  qualite: string;
  email: string;
  signeLe: Date;
  signaturePng: Uint8Array;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const vert = rgb(0.31, 0.6, 0.25);
  const gris = rgb(0.35, 0.35, 0.35);
  // Les polices standard ne gèrent que le jeu WinAnsi : on remplace le reste.
  const texte = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF€—–]/g, "?");
  let y = 790;
  const ligne = (t: string, taille = 11, police = normal, couleur = rgb(0.1, 0.1, 0.1)) => {
    page.drawText(texte(t), { x: 56, y, size: taille, font: police, color: couleur, maxWidth: 480 });
    y -= taille + 9;
  };

  try {
    const logo = await doc.embedJpg(await readFile(path.join(process.cwd(), "public", "logo-devis.jpg")));
    page.drawImage(logo, { x: 56, y: 770, width: 96, height: 44 });
    y = 740;
  } catch {
    // Logo absent : le document reste valable.
  }

  ligne("SARL OGEC SERVICES", 12, gras);
  ligne("918, Chemin Tour des Roches — 97460 Saint-Paul · 0262 26 00 86 · ogec.services@orange.fr", 9, normal, gris);
  y -= 16;
  ligne("BON POUR ACCORD", 22, gras, vert);
  ligne("Accord donné en ligne depuis l'espace client « Mon contrat OGEC »", 10, normal, gris);
  y -= 10;
  ligne(`Devis n° ${p.numeroDevis}${p.dateDevis ? ` du ${p.dateDevis}` : ""}`, 12, gras);
  if (p.objet) ligne(`Objet : ${p.objet}`);
  ligne(`Client : ${[p.client, p.site].filter(Boolean).join(" — ")}`);
  y -= 12;
  ligne("Je soussigné(e) donne mon accord pour la réalisation des travaux décrits dans le devis ci-dessus,", 11);
  ligne("aux conditions de ce devis et des conditions générales de vente qui y sont jointes.", 11);
  y -= 12;
  ligne(`Nom : ${p.nom}`, 11, gras);
  if (p.qualite) ligne(`Qualité : ${p.qualite}`);
  ligne(`Adresse email (connexion vérifiée) : ${p.email}`);
  ligne(`Signé le : ${p.signeLe.toLocaleString("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "long", timeStyle: "short" })}`);
  y -= 8;
  ligne("Signature :", 11, gras);
  try {
    const signature = await doc.embedPng(p.signaturePng);
    const largeur = 260;
    const hauteur = (signature.height / signature.width) * largeur;
    page.drawRectangle({ x: 56, y: y - hauteur - 6, width: largeur + 12, height: hauteur + 12, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
    page.drawImage(signature, { x: 62, y: y - hauteur, width: largeur, height: hauteur });
  } catch {
    ligne("(signature illisible)", 10, normal, gris);
  }
  return doc.save();
}
