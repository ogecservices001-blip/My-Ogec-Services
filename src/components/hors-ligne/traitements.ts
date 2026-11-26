"use client";

import { enregistrerTraitement } from "@/lib/hors-ligne/file-envoi";
import { effacerBrouillon } from "@/lib/hors-ligne/stockage";
import { envoyerCerfaParEmail, finaliserCerfa, type FinalisationCerfa } from "@/app/(app)/cerfa/actions";

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
