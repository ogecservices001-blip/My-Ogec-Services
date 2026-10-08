import { notFound } from "next/navigation";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommandeDetail } from "./detail";

export default async function CommandeFournisseurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data: commande } = await supabase.from("commandes_fournisseur").select("*").eq("id", id).single();
  if (!commande) notFound();

  const [{ data: devis }, { data: fournisseur }] = await Promise.all([
    supabase.from("devis").select("*").eq("id", commande.devis_id).single(),
    supabase.from("fournisseurs").select("*").eq("id", commande.fournisseur_id).single(),
  ]);
  const site = devis ? (await supabase.from("sites").select("nom, site").eq("id", devis.site_id).single()).data : null;

  return <CommandeDetail commande={commande} devis={devis} site={site} fournisseur={fournisseur} />;
}
