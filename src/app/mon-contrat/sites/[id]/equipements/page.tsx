import Link from "next/link";
import { ChevronRight, Cog } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { equipementsClient } from "@/lib/espace-client/donnees-parc";
import { Carte, Vide, jourCourt } from "../carte";

export const dynamic = "force-dynamic";

export default async function EquipementsClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, site } = await accesSite(id);
  const equipements = await equipementsClient(admin, site.id);

  const groupes = new Map<string, typeof equipements>();
  for (const e of equipements) groupes.set(e.groupe || "Autres équipements", [...(groupes.get(e.groupe || "Autres équipements") ?? []), e]);

  return (
    <Carte titre={`Votre parc — ${equipements.length} équipement${equipements.length > 1 ? "s" : ""}`} icone={Cog}>
      {equipements.length === 0 ? (
        <Vide>Aucun équipement enregistré pour ce site.</Vide>
      ) : (
        <div className="space-y-5">
          {[...groupes.entries()].map(([groupe, liste]) => (
            <div key={groupe}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{groupe}</p>
              <div className="divide-y divide-slate-100">
                {liste.map((e) => (
                  <Link key={e.id} href={`/mon-contrat/sites/${site.id}/equipements/${e.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{e.nom}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[e.famille, e.localisation].filter(Boolean).join(" · ")}
                        {e.historique[0] ? ` · dernière intervention le ${jourCourt(e.historique[0].date)}` : ""}
                      </p>
                      {e.prochainControle !== undefined && (
                        <p className="text-xs text-slate-500">
                          Contrôle d&apos;étanchéité : {e.prochainControle ? `prochain le ${e.prochainControle}` : "à programmer"}
                        </p>
                      )}
                    </div>
                    {e.etat && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          e.etat.bon ? "bg-[#eef6ec] text-[#3d7a32]" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {e.etat.libelle}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Carte>
  );
}
