import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { chargerDepannagesEnCours, chargerDevisARealiser, chargerBrouillonBI } from "./actions";
import { BiWizard } from "./wizard";
import { biDesInterventions, cleIntervention, creneauxDesInterventions, periodeIntervention } from "@/lib/planning/intervention";

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
    creneauId?: string;
  }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/");
  const { pole, devisId, depannageId, horsContrat, brouillonId, siteId, creneauId } = await searchParams;
  // Toujours ouvert avec un type, un devis, un dépannage ou un brouillon : seul, l'écran n'a pas d'usage.
  if (!pole && !devisId && !depannageId && !brouillonId) redirect("/");
  const supabase = await createClient();

  // Dépannage depuis le menu : on choisit d'abord le site (écran en pleine largeur).
  if (pole === "60" && !siteId && !depannageId && !brouillonId) {
    redirect(`/bi/depannage?horsContrat=${horsContrat === "1" ? 1 : 0}`);
  }

  const { data: equipeCreneau } = creneauId
    ? await supabase.from("creneau_techniciens").select("profiles(name)").eq("creneau_id", creneauId)
    : { data: [] };
  const techniciensCreneau = (equipeCreneau ?? []).flatMap((l) =>
    ((Array.isArray(l.profiles) ? l.profiles : l.profiles ? [l.profiles] : []) as { name: string }[]).map((p) => p.name),
  );

  let periodeCreneau: { debut: string; fin: string } | null = null;
  if (creneauId && !brouillonId) {
    const { data: creneau } = await supabase
      .from("creneaux_planning")
      .select("id, site_id, devis_id, visite_numero, visite_annee, date")
      .eq("id", creneauId)
      .single();
    if (creneau) {
      const groupe = await creneauxDesInterventions(supabase, [creneau]);
      const existant = (await biDesInterventions(supabase, groupe)).get(cleIntervention(creneau));
      if (existant) redirect(existant.statut === "brouillon" ? `/bi/nouveau?brouillonId=${existant.id}` : "/planning/mon-planning");
      const p = periodeIntervention(groupe, cleIntervention(creneau));
      const fr = (d: string) => d.split("-").reverse().join("/");
      if (p) periodeCreneau = { debut: fr(p.debut), fin: fr(p.fin) };
    }
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
      techniciensCreneau={techniciensCreneau}
      periodeCreneau={periodeCreneau}
    />
  );
}
