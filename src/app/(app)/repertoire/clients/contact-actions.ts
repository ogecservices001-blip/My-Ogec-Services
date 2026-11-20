"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import type { ActionResult } from "@/lib/action-result";
import { extraireContactDepuisCapture, type ContactExtraitResultat } from "@/lib/repertoire/contact-ocr";
import { EMPLACEMENTS_CONTACT, telephoneContact, type ContactSite } from "@/lib/repertoire/emplacements-contact";
import { contactsAvecCourriel, type ContactCourriel } from "@/lib/repertoire/contacts-courriel";

/// Lit la capture (signature de mail) et renvoie le contact détecté —
/// jamais enregistré ici, le bureau relit et choisit l'emplacement.
export async function analyserContactCapture(
  formData: FormData,
): Promise<{ ok: true; resultat: ContactExtraitResultat } | { ok: false; erreur: string }> {
  await requireAdmin();

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, erreur: "Aucune capture reçue." };
  const typesAcceptes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  if (!typesAcceptes.includes(fichier.type)) {
    return { ok: false, erreur: "Format non pris en charge — colle une capture d'écran ou choisis une image (PNG/JPEG) ou un PDF." };
  }

  try {
    const bytes = Buffer.from(await fichier.arrayBuffer());
    const resultat = await extraireContactDepuisCapture({ bytes, mimeType: fichier.type });
    if (!resultat.nom && !resultat.courriel && !resultat.fixe && !resultat.portable) {
      return { ok: false, erreur: "Aucune coordonnée trouvée sur cette capture." };
    }
    return { ok: true, resultat };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Échec de la lecture automatique." };
  }
}

export async function enregistrerContactSite(
  siteId: string,
  emplacement: string,
  contact: ContactSite,
): Promise<ActionResult> {
  await requireAdmin();

  const e = EMPLACEMENTS_CONTACT.find((x) => x.valeur === emplacement);
  if (!e) return { ok: false, erreur: "Emplacement inconnu." };
  const nom = contact.nom.trim();
  const courriel = contact.courriel.trim();
  if (!nom && !courriel) return { ok: false, erreur: "Renseigne au moins le nom ou le courriel." };

  const [cNom, cFixe, cPortable, cCourriel] = e.colonnes;
  const maj: Record<string, string> = {
    [cNom]: nom,
    [cFixe]: telephoneContact(contact.fixe),
    [cPortable]: telephoneContact(contact.portable),
    [cCourriel]: courriel,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("sites").update(maj).eq("id", siteId);
  if (error) return { ok: false, erreur: error.message };

  revalidatePath(`/repertoire/clients/${siteId}`);
  return { ok: true };
}

/// Contacts du site ayant un courriel, proposés à cocher avant l'envoi d'un
/// mail au client (devis, BI, rapport de visite, confirmation de dépannage).
/// Les contacts réservés aux admins sur la fiche site (responsable contrat,
/// facturation) ne sont proposés qu'aux admins.
export async function chargerContactsSite(siteId: string): Promise<ContactCourriel[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites").select("*").eq("id", siteId).single();
  return contactsAvecCourriel(site, profile.role === "admin" ? [] : ["responsable", "facturation"]);
}
