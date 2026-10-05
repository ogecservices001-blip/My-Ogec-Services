import { labelNatureDevis } from "@/lib/devis/constants";

export type DevisRegistreLigne = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  libelle: string;
  nature: string;
  montant: number | null;
  dateDevis: string;
  commande: boolean;
  annule: boolean;
};

export function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/// Carte "devis" commune au Registre global (/devis) et à la fiche
/// d'un client (/devis/groupe/[nom]) — même présentation partout,
/// qu'on affiche tous les clients ou un seul. `masquerClient` retire
/// la ligne client/site redondante quand le client est déjà le titre
/// de la page (fiche client : on montre alors juste le site).
export function ListeRegistreDevis({
  lignes,
  masquerClient = false,
}: {
  lignes: DevisRegistreLigne[];
  masquerClient?: boolean;
}) {
  return (
    <ul className="space-y-2.5">
      {lignes.map((d) => (
        <li key={d.id} className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-900">{d.numero || "(sans référence)"}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                d.annule
                  ? "bg-red-100 text-red-700"
                  : d.commande
                    ? "bg-green-100 text-brand-green-dark"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {d.annule ? "Annulée" : d.commande ? "Commandé" : "En attente"}
            </span>
            {d.nature && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                {labelNatureDevis(d.nature)}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-700">
            {masquerClient ? d.clientSite : [d.clientNom, d.clientSite].filter(Boolean).join(" — ")}
          </p>
          {d.libelle && <p className="truncate text-sm text-slate-500">{d.libelle}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            {d.dateDevis && <span>Devis du {d.dateDevis}</span>}
            {d.montant !== null && <span>{eur(d.montant)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
