import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte, sitesAutorises, type SiteClient } from "@/lib/espace-client/acces";

/// Contrôle commun des pages d'un site de « Mon contrat OGEC » : client
/// connecté sur cet appareil ET site ouvert pour son adresse.
export async function accesSite(siteId: string): Promise<{
  admin: ReturnType<typeof createAdminClient>;
  email: string;
  site: SiteClient;
  plusieursSites: boolean;
}> {
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) redirect("/mon-contrat");
  const sites = await sitesAutorises(admin, email);
  const site = sites.find((s) => s.id === siteId);
  if (!site) notFound();
  return { admin, email, site, plusieursSites: sites.length > 1 };
}
