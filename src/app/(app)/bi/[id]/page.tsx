import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Tables } from "@/lib/types";
import { BiDetail } from "./detail";

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
            "n_affaire, taux_horaire_regie, taux_horaire_revise, taux_horaire_vendu, forfait_deplacement, forfait_deplacement_revise",
          )
          .eq("id", bon.site_id)
          .single()
      : Promise.resolve({ data: null }),
    bon.site_id
      ? supabase.from("equipements").select("numero_equipement").eq("site_id", bon.site_id)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <BiDetail
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
