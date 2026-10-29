import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import { FilAjouter } from "@/components/fil-extra-context";
import type { Profil } from "@/lib/types";
import { ModifierProfilForm } from "../../modifier-form";

export default async function ModifierProfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOuAccueil();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!data) notFound();
  const profil = data as Profil;

  return (
    <div>
      <FilAjouter maillons={[{ nom: profil.name }, { nom: "Modifier" }]} />
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">{profil.name}</h1>
      <ModifierProfilForm profil={profil} />
    </div>
  );
}
