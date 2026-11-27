"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { chargerEquipementEtSite, emailConnuDuSite } from "@/lib/gmao/depannage";
import { enregistrerDemandeClient, type ResultatDemande } from "@/lib/gmao/demande-client";

export type { ResultatDemande };

/// Callable public : demande de dépannage depuis le QR d'un équipement.
/// L'adresse doit être connue du site ; l'accusé de réception part sur
/// cette adresse. Port de `soumettreDemandeDepannage` (functions/index.js).
export async function soumettreDemandeDepannage(codeQr: string, email: string, message: string): Promise<ResultatDemande> {
  if (!message.trim()) return { ok: false, erreur: "Merci de décrire la panne rencontrée." };

  const admin = createAdminClient();
  const chargement = await chargerEquipementEtSite(admin, codeQr);
  if (!chargement.ok) return chargement;

  const connu = await emailConnuDuSite(admin, chargement.donnees.site, email);
  if (!connu) return { ok: false, erreur: "Cette adresse email n'est pas reconnue pour ce site." };

  const { equipement, site } = chargement.donnees;
  return enregistrerDemandeClient(admin, {
    site,
    equipement: { id: equipement.id, nom: equipement.nom, localisation: equipement.localisation },
    email,
    message,
    origine: "QR",
  });
}
