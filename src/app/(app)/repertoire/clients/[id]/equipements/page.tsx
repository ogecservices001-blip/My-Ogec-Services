import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Equipement } from "@/lib/gmao/types";

/// Vue simple et rapide du parc d'un client, côté Répertoire — juste ce
/// qui est physiquement installé (nom, numéro, localisation), sans les
/// heures ni les actions de gestion (ajout, QR, relevé, import/export),
/// qui vivent dans le module GMAO (/gmao). Sert la consultation rapide
/// depuis la fiche client, pas le pilotage de l'entretien.
export default async function EquipementsClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: equipements }] = await Promise.all([
    supabase.from("sites").select("id, nom, site").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("site_id", id).order("nom"),
  ]);
  if (!site) notFound();

  const liste = (equipements ?? []) as Equipement[];

  const parGroupe = new Map<string, Equipement[]>();
  for (const eq of liste) {
    const g = eq.groupe.trim() || "Sans groupe";
    const l = parGroupe.get(g) ?? [];
    l.push(eq);
    parGroupe.set(g, l);
  }
  const groupesTries = [...parGroupe.keys()].sort((a, b) => {
    if (a === "Sans groupe") return 1;
    if (b === "Sans groupe") return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <Link
        href={`/repertoire/clients/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Équipements client</h1>
      <p className="mb-5 text-sm text-slate-500">
        {[site.nom, site.site].filter(Boolean).join(" — ")} — {liste.length} équipement(s)
      </p>

      {liste.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun équipement enregistré pour ce client</p>
      ) : (
        <div className="space-y-4">
          {groupesTries.map((groupe) => (
            <div key={groupe}>
              {groupesTries.length > 1 && (
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{groupe}</p>
              )}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                {parGroupe.get(groupe)!.map((eq, i) => (
                  <div
                    key={eq.id}
                    className={`flex items-center gap-2.5 px-4 py-2.5 text-sm ${i > 0 ? "border-t border-slate-50" : ""}`}
                  >
                    <Cog className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} />
                    <span className="min-w-0 truncate text-slate-800">
                      {[eq.nom, eq.numero_equipement, eq.localisation].filter(Boolean).join(" ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
