import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { freqCouranteCalculee } from "@/lib/gmao/releve-service";
import type { Equipement, TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { chargerDevisEnCoursParEquipement } from "@/lib/devis/en-cours";
import { ReleveForm } from "./releve-form";

export default async function NouveauRelevePage({
  params,
}: {
  params: Promise<{ id: string; equipementId: string }>;
}) {
  const profile = await requireProfile();
  const { id, equipementId } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: eqData }, { data: references }, { data: techniciens }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("id", equipementId).eq("site_id", id).single(),
    supabase.from("references_horaires").select("*"),
    supabase.from("profiles").select("name").in("role", ["technicien", "en_attente"]).order("name"),
  ]);
  if (!site || !eqData) notFound();
  const equipement = eqData as Equipement;

  const { data: typeData } = await supabase
    .from("types_equipement")
    .select("*")
    .eq("id", equipement.type_equipement_id)
    .single();
  if (!typeData) notFound();
  const type = typeData as TypeEquipement;

  const freqCourante = await freqCouranteCalculee(supabase, equipementId);
  const nomsTechniciens = [...new Set((techniciens ?? []).map((t) => t.name).filter(Boolean))];

  const [devisEnCours, { data: depannagesOuverts }] = await Promise.all([
    chargerDevisEnCoursParEquipement().then((parEquipement) => parEquipement[equipementId] ?? []),
    supabase
      .from("demandes_depannage")
      .select("id, numero, message")
      .eq("equipement_id", equipementId)
      .neq("statut", "traitee")
      .order("date_creation", { ascending: false }),
  ]);

  return (
    <ReleveForm
      siteId={id}
      site={site}
      equipement={equipement}
      type={type}
      references={(references ?? []) as ReferenceHoraire[]}
      freqCourante={freqCourante}
      nomTechInitial={profile.name}
      nomsTechniciens={nomsTechniciens}
      devisEnCours={devisEnCours}
      depannagesOuverts={depannagesOuverts ?? []}
    />
  );
}
