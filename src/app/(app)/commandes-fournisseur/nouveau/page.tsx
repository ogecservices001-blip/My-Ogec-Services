import { notFound } from "next/navigation";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NouvelleCommandeForm } from "./nouvelle-commande-form";

export default async function NouvelleCommandePage({
  searchParams,
}: {
  searchParams: Promise<{ devisId?: string }>;
}) {
  await requireAdminOuAccueil();
  const { devisId } = await searchParams;
  if (!devisId) notFound();

  const supabase = await createClient();
  const { data: devis } = await supabase.from("devis").select("*").eq("id", devisId).single();
  if (!devis) notFound();

  const [{ data: site }, { data: fournisseurs }] = await Promise.all([
    supabase.from("sites").select("nom, site").eq("id", devis.site_id).single(),
    supabase.from("fournisseurs").select("*").order("nom"),
  ]);

  return (
    <NouvelleCommandeForm
      devis={{ id: devis.id, numero: devis.numero, libelle: devis.libelle }}
      site={site ?? null}
      fournisseurs={fournisseurs ?? []}
    />
  );
}
