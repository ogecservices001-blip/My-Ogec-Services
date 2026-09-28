import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Fournisseur } from "@/lib/types";

export default async function FournisseurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("fournisseurs")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const f = data as Fournisseur;

  const champs: [string, string][] = [
    ["Dénomination courte", f.denomination_courte],
    ["Interlocuteurs", f.interlocuteurs],
    ["Tél fixe", f.tel],
    ["Portable", f.portable],
    ["Courriel", f.courriel],
    ["Site web", f.site_web],
    ["Commune", f.commune],
    ["Code postal", f.code_postal],
    ["Adresse", f.adresse],
    ["Complément d'adresse", f.complement_adresse],
    ["Produits clés", f.produits_cles],
    ["Remarques", f.remarques],
  ];

  return (
    <div>
      <Link
        href="/repertoire/fournisseurs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Retour
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">
        {f.nom}
      </h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <dl>
          {champs.map(([label, valeur], i) => (
            <div
              key={label}
              className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-2 ${
                i > 0 ? "border-t border-slate-50" : ""
              }`}
            >
              <dt className="text-[13px] text-slate-500 sm:w-52 sm:shrink-0">
                {label}
              </dt>
              <dd
                className={
                  valeur
                    ? "text-sm font-medium text-slate-900"
                    : "text-sm text-slate-300"
                }
              >
                {valeur || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
