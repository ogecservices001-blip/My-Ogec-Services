import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Fournisseur } from "@/lib/types";
import { FournisseurForm } from "../../fournisseur-form";

export default async function ModifierFournisseurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
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
      <Link
        href={`/repertoire/fournisseurs/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">
        {fournisseur.nom}
      </h1>
      <FournisseurForm fournisseur={fournisseur} />
    </div>
  );
}
