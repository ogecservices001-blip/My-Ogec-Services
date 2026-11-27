import { Wrench } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { depannagesClient, equipementsClient } from "@/lib/espace-client/donnees-parc";
import { Carte, Vide, jourCourt } from "../carte";
import { DeclarerPanne } from "./declarer-panne";

export const dynamic = "force-dynamic";

const ETATS = {
  recue: { libelle: "Demande reçue", style: "bg-slate-100 text-slate-600" },
  planifiee: { libelle: "Intervention planifiée", style: "bg-blue-100 text-blue-700" },
  realisee: { libelle: "Intervention réalisée", style: "bg-[#eef6ec] text-[#3d7a32]" },
} as const;

export default async function DepannagesClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, site } = await accesSite(id);
  const [demandes, equipements] = await Promise.all([depannagesClient(admin, site.id), equipementsClient(admin, site.id)]);

  return (
    <div className="space-y-5">
      <DeclarerPanne siteId={site.id} equipements={equipements.map((e) => ({ id: e.id, nom: [e.nom, e.localisation].filter(Boolean).join(" — ") }))} />
      <Carte titre="Vos demandes de dépannage" icone={Wrench}>
        {demandes.length === 0 ? (
          <Vide>Aucune demande de dépannage pour ce site.</Vide>
        ) : (
          <ul className="divide-y divide-slate-100">
            {demandes.map((d) => (
              <li key={d.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    N°{d.numero} · demandé le {jourCourt(d.dateDemande)}
                  </p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ETATS[d.etat].style}`}>
                    {ETATS[d.etat].libelle}
                    {d.etat === "planifiee" && d.datePrevue ? ` le ${jourCourt(d.datePrevue)}` : ""}
                  </span>
                </div>
                {d.equipement && <p className="text-sm text-slate-600">{d.equipement}</p>}
                {d.message && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{d.message}</p>}
                {d.biId && (
                  <a href={`/mon-contrat/pdf/bi/${d.biId}`} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-sm font-semibold text-[#3d7a32] hover:underline">
                    Bon d&apos;intervention
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
