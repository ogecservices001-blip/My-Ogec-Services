import Link from "next/link";
import { FileSignature } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { devisClient } from "@/lib/espace-client/donnees-parc";
import { Carte, Vide, jourCourt } from "../carte";

export const dynamic = "force-dynamic";

const STYLES: Record<string, string> = {
  "En attente de votre accord": "bg-amber-100 text-amber-800",
  "Commandé — travaux à venir": "bg-blue-100 text-blue-700",
  "Travaux réalisés": "bg-[#eef6ec] text-[#3d7a32]",
  "Non retenu": "bg-slate-100 text-slate-500",
};

export default async function DevisClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, site } = await accesSite(id);
  const devis = await devisClient(admin, site.id);

  return (
    <Carte titre="Vos devis" icone={FileSignature}>
      {devis.length === 0 ? (
        <Vide>Aucun devis pour ce site.</Vide>
      ) : (
        <ul className="divide-y divide-slate-100">
          {devis.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{d.objet}</p>
                <p className="text-sm text-slate-500">Devis du {jourCourt(d.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STYLES[d.etat] ?? "bg-slate-100 text-slate-600"}`}>{d.etat}</span>
                {d.attenteAccord && (
                  <Link
                    href={`/mon-contrat/sites/${site.id}/devis/${d.id}`}
                    className="rounded-xl bg-[#4f9a41] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#3d7a32]"
                  >
                    Donner mon accord
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-400">Le détail chiffré de chaque devis vous a été adressé par email.</p>
    </Carte>
  );
}
