import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement } from "@/lib/gmao/types";
import { chargerDepannagesEnCours, chargerDevisARealiser } from "./actions";
import { BiWizard } from "./wizard";

/// Le bureau (admin) ne crée jamais de BI lui-même — il ne fait que
/// vérifier/valider ceux créés par les techniciens (page /bi).
export default async function NouveauBiPage({
  searchParams,
}: {
  searchParams: Promise<{ pole?: string; devisId?: string; depannageId?: string; horsContrat?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/");
  const { pole, devisId, depannageId, horsContrat } = await searchParams;
  const supabase = await createClient();

  const [{ data: sites }, { data: techniciens }, { data: typesEquipement }, depannagesEnCours, devisARealiser] = await Promise.all([
    supabase
      .from("sites_view")
      .select(
        "id, nom, site, hors_contrat, adresse, code_postal, commune, interlocuteur_site, tel_fixe_interlocuteur_site, portable_interlocuteur_site, courriel_interlocuteur_site",
      )
      .order("nom"),
    supabase.from("profiles").select("id, name").in("role", ["technicien", "en_attente"]).order("name"),
    supabase.from("types_equipement").select("*").order("nom"),
    chargerDepannagesEnCours(),
    chargerDevisARealiser(),
  ]);

  return (
    <BiWizard
      key={`${pole ?? ""}|${devisId ?? ""}|${depannageId ?? ""}|${horsContrat ?? ""}`}
      sites={sites ?? []}
      techniciensDisponibles={(techniciens ?? []).map((t) => t.name)}
      typesEquipement={(typesEquipement ?? []) as TypeEquipement[]}
      nomUtilisateur={profile.name}
      depannagesEnCours={depannagesEnCours}
      devisARealiser={devisARealiser}
    />
  );
}
