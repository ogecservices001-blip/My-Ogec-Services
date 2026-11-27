"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { consommerLien, creerLien, emailValide, fermerSession, normaliserEmail, sitesAutorises } from "@/lib/espace-client/acces";
import { envoyerLienConnexion } from "@/lib/espace-client/email";
import { messageErreur, signalerIncident } from "@/lib/incidents";

/// Demande de lien de connexion. Réponse identique que l'adresse ait un
/// accès ou non, pour ne rien révéler.
export async function demanderLienConnexion(email: string): Promise<{ ok: true }> {
  const adresse = normaliserEmail(email);
  if (!emailValide(adresse)) return { ok: true };
  const admin = createAdminClient();
  if ((await sitesAutorises(admin, adresse)).length === 0) return { ok: true };
  try {
    const jeton = await creerLien(admin, adresse);
    if (jeton) await envoyerLienConnexion(adresse, jeton);
  } catch (e) {
    await signalerIncident({ source: "mail", titre: "Mon contrat OGEC : lien de connexion non envoyé", detail: `${adresse}\n${messageErreur(e)}` });
  }
  return { ok: true };
}

export async function seConnecter(jeton: string): Promise<{ ok: false; erreur: string }> {
  const resultat = await consommerLien(createAdminClient(), jeton);
  if (!resultat.ok) {
    return { ok: false, erreur: "Ce lien a expiré ou a déjà servi. Demandez un nouveau lien de connexion." };
  }
  redirect("/mon-contrat/sites");
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession(createAdminClient());
  redirect("/mon-contrat");
}
