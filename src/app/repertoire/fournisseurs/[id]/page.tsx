import { notFound } from "next/navigation";
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
      <h1 className="mb-4 text-xl font-bold text-slate-900">{f.nom}</h1>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <dl className="space-y-2">
          {champs.map(([label, valeur]) => (
            <div key={label} className="flex flex-col sm:flex-row sm:gap-2">
              <dt className="text-sm font-medium text-slate-600 sm:w-48 sm:shrink-0">
                {label}
              </dt>
              <dd className={valeur ? "text-sm text-slate-900" : "text-sm text-slate-400"}>
                {valeur || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
