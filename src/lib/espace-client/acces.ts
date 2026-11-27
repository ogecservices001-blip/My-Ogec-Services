import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAMPS_CONTACTS, contactsDuSite, emailValide, normaliserEmail } from "./contacts";

export { contactsDuSite, emailValide, normaliserEmail };

/// « Mon contrat OGEC » : règles d'accès de l'espace client.
/// Un contact accède à un site si le bureau l'a activé (acces_clients) ET si
/// son adresse figure toujours sur la fiche du site : un contact retiré de
/// la fiche perd l'accès de lui-même.

export const COOKIE_SESSION = "ogec_contrat";
export const DUREE_SESSION_JOURS = 30;
const DUREE_LIEN_MINUTES = 30;
const DUREE_INVITATION_JOURS = 7;
const MAX_LIENS_PAR_HEURE = 5;

type Admin = ReturnType<typeof createAdminClient>;

const hacher = (jeton: string) => createHash("sha256").update(jeton).digest("hex");
const nouveauJeton = () => randomBytes(32).toString("base64url");

const COLONNES_SITE = `id, nom, site, adresse, code_postal, commune, ${CHAMPS_CONTACTS.flatMap((c) => [c.courriel, c.nom]).join(", ")}`;

export type SiteClient = { id: string; nom: string; site: string; adresse: string; code_postal: string; commune: string };

/// Sites auxquels cette adresse a accès aujourd'hui.
export async function sitesAutorises(admin: Admin, email: string): Promise<SiteClient[]> {
  const adresse = normaliserEmail(email);
  if (!adresse) return [];
  const { data: acces } = await admin.from("acces_clients").select("site_id").eq("email", adresse).is("revoque_le", null);
  const ids = [...new Set((acces ?? []).map((a) => a.site_id))];
  if (ids.length === 0) return [];
  const { data: sites } = await admin.from("sites").select(COLONNES_SITE).in("id", ids);
  return ((sites ?? []) as unknown as Record<string, unknown>[])
    .filter((s) => contactsDuSite(s).some((c) => c.email === adresse))
    .map((s) => ({
      id: String(s.id),
      nom: String(s.nom ?? ""),
      site: String(s.site ?? ""),
      adresse: String(s.adresse ?? ""),
      code_postal: String(s.code_postal ?? ""),
      commune: String(s.commune ?? ""),
    }))
    .sort((a, b) => `${a.nom} ${a.site}`.localeCompare(`${b.nom} ${b.site}`, "fr"));
}

/// Lien de connexion à usage unique. `null` si trop de demandes récentes.
export async function creerLien(admin: Admin, email: string, dureeMinutes = DUREE_LIEN_MINUTES): Promise<string | null> {
  const adresse = normaliserEmail(email);
  const depuis = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("connexions_clients")
    .select("id", { count: "exact", head: true })
    .eq("email", adresse)
    .eq("type", "lien")
    .gte("created_at", depuis);
  if ((count ?? 0) >= MAX_LIENS_PAR_HEURE) return null;
  const jeton = nouveauJeton();
  const { error } = await admin.from("connexions_clients").insert({
    type: "lien",
    email: adresse,
    jeton_hash: hacher(jeton),
    expire_le: new Date(Date.now() + dureeMinutes * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return jeton;
}

export const dureeInvitationMinutes = DUREE_INVITATION_JOURS * 24 * 60;

/// Échange un lien reçu par mail contre une session de 30 jours (cookie).
export async function consommerLien(admin: Admin, jeton: string): Promise<{ ok: true; email: string } | { ok: false }> {
  const { data: lien } = await admin
    .from("connexions_clients")
    .select("id, email, expire_le, utilise_le, revoque_le")
    .eq("jeton_hash", hacher(jeton))
    .eq("type", "lien")
    .maybeSingle();
  if (!lien || lien.utilise_le || lien.revoque_le || new Date(lien.expire_le) < new Date()) return { ok: false };
  const { data: marque } = await admin
    .from("connexions_clients")
    .update({ utilise_le: new Date().toISOString() })
    .eq("id", lien.id)
    .is("utilise_le", null)
    .select("id");
  if (!marque?.length) return { ok: false };
  if ((await sitesAutorises(admin, lien.email)).length === 0) return { ok: false };

  const session = nouveauJeton();
  const expire = new Date(Date.now() + DUREE_SESSION_JOURS * 86_400_000);
  await admin.from("connexions_clients").insert({ type: "session", email: lien.email, jeton_hash: hacher(session), expire_le: expire.toISOString() });
  await admin.from("acces_clients").update({ derniere_connexion: new Date().toISOString() }).eq("email", lien.email).is("revoque_le", null);
  (await cookies()).set(COOKIE_SESSION, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/mon-contrat",
    expires: expire,
  });
  return { ok: true, email: lien.email };
}

/// Adresse du client connecté sur cet appareil, ou null.
export async function emailConnecte(admin: Admin): Promise<string | null> {
  const jeton = (await cookies()).get(COOKIE_SESSION)?.value;
  if (!jeton) return null;
  const { data: session } = await admin
    .from("connexions_clients")
    .select("email, expire_le, revoque_le")
    .eq("jeton_hash", hacher(jeton))
    .eq("type", "session")
    .maybeSingle();
  if (!session || session.revoque_le || new Date(session.expire_le) < new Date()) return null;
  return session.email;
}

export async function fermerSession(admin: Admin): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(COOKIE_SESSION)?.value;
  if (jeton) {
    await admin.from("connexions_clients").update({ revoque_le: new Date().toISOString() }).eq("jeton_hash", hacher(jeton));
  }
  magasin.delete({ name: COOKIE_SESSION, path: "/mon-contrat" });
}

/// Le client connecté a-t-il accès à ce site ? Renvoie le site, ou null.
export async function siteDuClient(admin: Admin, email: string, siteId: string): Promise<SiteClient | null> {
  return (await sitesAutorises(admin, email)).find((s) => s.id === siteId) ?? null;
}
