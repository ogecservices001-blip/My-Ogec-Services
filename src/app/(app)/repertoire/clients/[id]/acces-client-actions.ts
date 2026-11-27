"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { contactsDuSite, creerLien, dureeInvitationMinutes, normaliserEmail } from "@/lib/espace-client/acces";
import { envoyerInvitation } from "@/lib/espace-client/email";
import { messageErreur, signalerIncident } from "@/lib/incidents";
import type { ActionResult } from "@/lib/action-result";

/// Active (ou réactive) l'accès « Mon contrat OGEC » d'un contact de la
/// fiche site et lui envoie l'invitation. Client admin : les tables d'accès
/// ne sont lues que côté serveur.
export async function activerAccesClient(siteId: string, email: string): Promise<ActionResult> {
  const profile = await requireAdmin();
  const admin = createAdminClient();
  const adresse = normaliserEmail(email);
  const { data: site } = await admin.from("sites").select("*").eq("id", siteId).single();
  if (!site) return { ok: false, erreur: "Site introuvable." };
  const contact = contactsDuSite(site as Record<string, unknown>).find((c) => c.email === adresse);
  if (!contact) return { ok: false, erreur: "Cette adresse ne figure pas sur la fiche du site." };

  const { error } = await admin.from("acces_clients").upsert(
    {
      site_id: siteId,
      email: adresse,
      nom: contact.nom,
      active_par: profile.name,
      revoque_le: null,
      invite_le: new Date().toISOString(),
    },
    { onConflict: "site_id,email" },
  );
  if (error) return { ok: false, erreur: error.message };

  try {
    const jeton = await creerLien(admin, adresse, dureeInvitationMinutes);
    if (!jeton) return { ok: false, erreur: "Trop d'envois récents pour cette adresse : réessayez dans une heure." };
    await envoyerInvitation({ destinataire: adresse, nom: contact.nom, site: [site.nom, site.site].filter(Boolean).join(" — "), jeton });
  } catch (e) {
    await signalerIncident({
      source: "mail",
      titre: `Mon contrat OGEC : invitation non envoyée — ${adresse}`,
      detail: messageErreur(e),
      objetType: "site",
      objetId: siteId,
      lien: `/repertoire/clients/${siteId}`,
    });
    return { ok: false, erreur: "Accès activé, mais l'invitation n'a pas pu partir. Réessayez « Renvoyer l'invitation »." };
  }
  revalidatePath(`/repertoire/clients/${siteId}`);
  revalidatePath("/acces-clients");
  return { ok: true };
}

export async function couperAccesClient(siteId: string, email: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("acces_clients")
    .update({ revoque_le: new Date().toISOString() })
    .eq("site_id", siteId)
    .eq("email", normaliserEmail(email));
  if (error) return { ok: false, erreur: error.message };
  revalidatePath(`/repertoire/clients/${siteId}`);
  revalidatePath("/acces-clients");
  return { ok: true };
}
