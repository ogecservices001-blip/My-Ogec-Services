import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { FilAjouter } from "@/components/fil-extra-context";
import type { Fournisseur } from "@/lib/types";
import { FournisseurForm } from "../../fournisseur-form";

export default async function ModifierFournisseurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("fournisseurs")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const fournisseur = data as Fournisseur;

  return (
    <div>
      <FilAjouter
        maillons={[{ nom: fournisseur.nom, href: `/repertoire/fournisseurs/${id}` }, { nom: "Modifier" }]}
      />
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">
        {fournisseur.nom}
      </h1>
      <FournisseurForm fournisseur={fournisseur} />
    </div>
  );
}
