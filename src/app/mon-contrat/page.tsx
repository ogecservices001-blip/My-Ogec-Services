import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte } from "@/lib/espace-client/acces";
import { FormulaireConnexion } from "./formulaire-connexion";

export const dynamic = "force-dynamic";

export default async function MonContratConnexionPage() {
  if (await emailConnecte(createAdminClient())) redirect("/mon-contrat/sites");
  return <FormulaireConnexion />;
}
