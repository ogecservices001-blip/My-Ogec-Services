import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { chargerDepannagesEnCours, chargerDevisARealiser, chargerBrouillonBI } from "./actions";
import { BiWizard } from "./wizard";

/// Le bureau (admin) ne crée jamais de BI lui-même — il ne fait que
/// vérifier/valider ceux créés par les techniciens (page /bi).
export default async function NouveauBiPage({
  searchParams,
}: {
  searchParams: Promise<{
    pole?: string;
    devisId?: string;
    depannageId?: string;
    horsContrat?: string;
    brouillonId?: string;
    siteId?: string;
  }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/");
  const { pole, devisId, depannageId, horsContrat, brouillonId, siteId } = await searchParams;
  // Toujours ouvert avec un type, un devis, un dépannage ou un brouillon : seul, l'écran n'a pas d'usage.
  if (!pole && !devisId && !depannageId && !brouillonId) redirect("/");
  const supabase = await createClient();

  // Dépannage depuis le menu : on choisit d'abord le site (écran en pleine largeur).
  if (pole === "60" && !siteId && !depannageId && !brouillonId) {
    redirect(`/bi/depannage?horsContrat=${horsContrat === "1" ? 1 : 0}`);
  }

  const [{ data: sites }, { data: techniciens }, { data: typesEquipement }, { data: references }, depannagesEnCours, devisARealiser, brouillon] =
    await Promise.all([
      supabase
        .from("sites_view")
        .select(
          "id, nom, site, hors_contrat, adresse, code_postal, commune, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site, courriel_interlocuteur_site",
        )
        .order("nom"),
      supabase.from("profiles").select("id, name").in("role", ["technicien", "en_attente"]).order("name"),
      supabase.from("types_equipement").select("*").order("nom"),
      supabase.from("references_horaires").select("*"),
      chargerDepannagesEnCours(),
      chargerDevisARealiser(),
      brouillonId ? chargerBrouillonBI(brouillonId) : Promise.resolve(null),
    ]);

  return (
    <BiWizard
      key={`${pole ?? ""}|${devisId ?? ""}|${depannageId ?? ""}|${horsContrat ?? ""}|${brouillonId ?? ""}|${siteId ?? ""}`}
      sites={sites ?? []}
      techniciensDisponibles={(techniciens ?? []).map((t) => t.name)}
      typesEquipement={(typesEquipement ?? []) as TypeEquipement[]}
      references={(references ?? []) as ReferenceHoraire[]}
      nomUtilisateur={profile.name}
      depannagesEnCours={depannagesEnCours}
      devisARealiser={devisARealiser}
      brouillon={brouillon}
    />
  );
}
