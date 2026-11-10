import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Tables } from "@/lib/types";
import { BiDetail, type InfosVisite } from "./detail";
import { Poles, Statuts } from "@/lib/bi/constants";
import { equipementsEntretenus, proposerVisite, visitesDejaValidees } from "@/lib/gmao/visites";

export default async function BiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const [{ data: bon }, { data: techniciens }, { data: typesEquipement }] = await Promise.all([
    supabase.from("bons_intervention").select("*").eq("id", id).single(),
    supabase.from("profiles").select("id, name").in("role", ["technicien", "en_attente"]).order("name"),
    supabase.from("types_equipement").select("id, nom, champs_en_tete_supplementaires"),
  ]);
  if (!bon) notFound();

  const { data: modele } = await supabase
    .from("bi_modeles")
    .select("champs, checklist")
    .eq("pole", bon.pole)
    .maybeSingle();

  const [{ data: site }, { data: equipementsSite }] = await Promise.all([
    bon.site_id
      ? supabase
          .from("sites")
          .select(
            "n_affaire, taux_horaire_regie, forfait_deplacement",
          )
          .eq("id", bon.site_id)
          .single()
      : Promise.resolve({ data: null }),
    bon.site_id
      ? supabase.from("equipements").select("numero_equipement").eq("site_id", bon.site_id)
      : Promise.resolve({ data: [] }),
  ]);

  let infosVisite: InfosVisite | null = null;
  if (bon.pole === Poles.entretienSousContrat) {
    const tous = await equipementsEntretenus(supabase, bon);
    const deja = await visitesDejaValidees(supabase, tous.map((e) => e.id), bon.visite_numero, bon.visite_annee, bon.id);
    const entretenus = tous.filter((e) => !deja.has(e.id));
    const ids = entretenus.map((e) => e.id);
    const { data: releves } =
      ids.length > 0
        ? await supabase.from("releves").select("equipement_id, bon_intervention_id").in("equipement_id", ids)
        : { data: [] };
    const valide = bon.statut !== Statuts.brouillon && bon.statut !== Statuts.aVerifier;
    // Avant validation : relevés en attente de rattachement ; après : ceux rattachés à ce BI.
    const avecReleve = new Set(
      (releves ?? [])
        .filter((r) => (valide ? r.bon_intervention_id === bon.id : r.bon_intervention_id === null))
        .map((r) => r.equipement_id),
    );
    infosVisite = {
      proposition: await proposerVisite(supabase, bon, entretenus),
      equipements: entretenus.map((e) => ({ nom: e.nom, avecReleve: avecReleve.has(e.id) })),
      relevesEnAttente: valide ? (releves ?? []).filter((r) => r.bon_intervention_id === null).length : 0,
      dejaFaits: tous.filter((e) => deja.has(e.id)).map((e) => ({ nom: e.nom, bi: deja.get(e.id)! })),
    };
  }

  // Tout autre BI : relevés techniques qui lui sont rattachés (ex. entretien
  // d'un équipement hors contrat à facturer).
  let relevesRattaches: { nom: string; fonctionnement: string }[] = [];
  if (bon.pole !== Poles.entretienSousContrat) {
    const { data: rel } = await supabase
      .from("releves")
      .select("validation_fonctionnement, equipements(nom)")
      .eq("bon_intervention_id", bon.id);
    relevesRattaches = ((rel ?? []) as unknown as { validation_fonctionnement: string | null; equipements: { nom: string } | null }[]).map(
      (r) => ({ nom: r.equipements?.nom ?? "Équipement", fonctionnement: r.validation_fonctionnement ?? "Fait" }),
    );
  }

  return (
    <BiDetail
      relevesRattaches={relevesRattaches}
      infosVisite={infosVisite}
      bon={bon as Tables<"bons_intervention">}
      techniciensDisponibles={(techniciens ?? []).map((t) => t.name)}
      typesEquipement={typesEquipement ?? []}
      modele={modele ?? null}
      isAdmin={profile?.role === "admin"}
      tauxSite={site}
      numeroAffaireSite={site?.n_affaire ?? ""}
      numerosEquipementSite={(equipementsSite ?? []).map((e) => e.numero_equipement).filter(Boolean)}
    />
  );
}
