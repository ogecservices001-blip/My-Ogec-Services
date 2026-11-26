"use client";

import { enregistrerTraitement } from "@/lib/hors-ligne/file-envoi";
import { effacerBrouillon } from "@/lib/hors-ligne/stockage";
import { envoyerCerfaParEmail, finaliserCerfa, type FinalisationCerfa } from "@/app/(app)/cerfa/actions";
import { creerReleve } from "@/app/(app)/gmao/clients/[id]/equipements/[equipementId]/releve/actions";
import { enregistrerBI } from "@/app/(app)/bi/nouveau/actions";
import { effacerPhotosLocales, photosServeur, televerserPhotosLocales, type BiEnAttente } from "@/lib/hors-ligne/bi";

/// CERFA validé sans réseau : finalisé (n°, PDF, fiche équipement) au retour
/// du réseau, puis envoyé au client si le technicien l'a demandé.
export type CerfaEnAttente = { finalisation: FinalisationCerfa; cleBrouillon: string; emailClient: string };

enregistrerTraitement("cerfa", async (payload) => {
  const p = payload as CerfaEnAttente;
  const r = await finaliserCerfa(p.finalisation);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  await effacerBrouillon(p.cleBrouillon);
  if (p.emailClient.trim() && r.id) {
    const envoi = await envoyerCerfaParEmail(r.id, p.emailClient.split(/[;,]/));
    if (!envoi.ok) return { ok: true, message: `CERFA ${r.numero} enregistré, mais mail non envoyé : ${envoi.erreur}` };
  }
  return { ok: true, message: `CERFA ${r.numero} enregistré` };
});

/// Relevé GMAO enregistré sans réseau : le formulaire tel qu'il a été validé
/// (avec sa clé d'envoi, pour ne jamais créer deux fois le même relevé).
export type ReleveEnAttente = { equipementId: string; siteId: string; champs: Record<string, string> };

enregistrerTraitement("releve", async (payload) => {
  const p = payload as ReleveEnAttente;
  const fd = new FormData();
  for (const [cle, valeur] of Object.entries(p.champs)) fd.append(cle, valeur);
  const r = await creerReleve(p.equipementId, p.siteId, null, fd);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  return { ok: true, message: "Relevé enregistré" };
});

/// BI signé sans réseau : ses photos prises hors réseau partent d'abord, puis
/// le BI est transmis au bureau.
enregistrerTraitement("bi", async (payload) => {
  const p = payload as BiEnAttente;
  const photos = await televerserPhotosLocales(p.photos);
  const r = await enregistrerBI({ ...p.input, photos: photosServeur(photos) }, "averif", p.brouillonId ?? undefined);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  await effacerPhotosLocales(p.photos);
  return { ok: true, message: "BI transmis au bureau" };
});
