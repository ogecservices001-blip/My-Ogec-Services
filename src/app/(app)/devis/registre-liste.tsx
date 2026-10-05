import Link from "next/link";
import { labelNatureDevis } from "@/lib/devis/constants";
import { calculerStatutDevis, LABEL_STATUT_DEVIS, TEINTE_STATUT_DEVIS } from "./statut";

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
  realise: boolean;
  annule: boolean;
};

export function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/// "D-26-279-BG-405-01-30" → "D-26-279" — seules les 3 premières
/// parties (type-année-chrono) comptent pour reconnaître un devis au
/// coup d'œil, le reste (rédacteur, affaire, pôle) alourdit la colonne
/// sans apporter d'info utile dans ce tableau.
function numeroCourt(numero: string): string {
  return numero.split("-").slice(0, 3).join("-");
}

const TEINTE_STATUT = (d: DevisRegistreLigne) => TEINTE_STATUT_DEVIS[calculerStatutDevis(d)];
const LABEL_STATUT = (d: DevisRegistreLigne) => LABEL_STATUT_DEVIS[calculerStatutDevis(d)];

/// Tableau façon classeur Excel pour le Chrono Devis (/devis, onglet
/// "Chrono Devis") — même esprit que l'Audit Heures GMAO : une ligne
/// par devis, colonne N° figée au scroll, ligne de total en bas.
export function TableauRegistreDevis({ lignes, isAdmin }: { lignes: DevisRegistreLigne[]; isAdmin: boolean }) {
  const totalMontant = lignes.filter((l) => !l.annule).reduce((s, l) => s + (l.montant ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
      <table className="w-full min-w-[700px] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 w-[8%] border-b border-slate-200 bg-white px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              N°
            </th>
            <th className="w-[27%] border-b border-slate-200 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              Client — Site
            </th>
            <th className="w-[29%] border-b border-slate-200 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              Libellé
            </th>
            <th className="w-[6%] border-b border-slate-200 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              Nature
            </th>
            <th className="w-[9%] border-b border-slate-200 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              Date devis
            </th>
            {isAdmin && (
              <th className="w-[11%] border-b border-slate-200 px-2 py-2 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                Montant
              </th>
            )}
            <th className="w-[10%] border-b border-slate-200 px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              Statut
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((d, i) => (
            <tr key={d.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
              <td className="sticky left-0 truncate border-b border-slate-100 bg-inherit px-2 py-2 font-semibold text-slate-900">
                {d.numero ? numeroCourt(d.numero) : "—"}
              </td>
              <td className="truncate border-b border-slate-100 px-2 py-2 text-slate-700">
                {[d.clientNom, d.clientSite].filter(Boolean).join(" — ")}
              </td>
              <td className="truncate border-b border-slate-100 px-2 py-2 text-slate-500">{d.libelle}</td>
              <td className="truncate border-b border-slate-100 px-2 py-2 text-slate-500">{d.nature}</td>
              <td className="truncate border-b border-slate-100 px-2 py-2 text-slate-500">{d.dateDevis}</td>
              {isAdmin && (
                <td className="truncate border-b border-slate-100 px-2 py-2 text-right text-slate-700">
                  {d.montant !== null ? eur(d.montant) : ""}
                </td>
              )}
              <td className="truncate border-b border-slate-100 px-2 py-2">
                {isAdmin ? (
                  <Link
                    href={`/devis/${d.id}/statut`}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition hover:opacity-75 ${TEINTE_STATUT(d)}`}
                  >
                    {LABEL_STATUT(d)}
                  </Link>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TEINTE_STATUT(d)}`}>
                    {LABEL_STATUT(d)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        {isAdmin && (
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900">
              <td className="sticky left-0 bg-slate-100 px-2 py-2" colSpan={5}>
                Total
              </td>
              <td className="px-2 py-2 text-right">{eur(totalMontant)}</td>
              <td className="px-2 py-2" />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/// Carte "devis" commune à la fiche d'un client (/devis/groupe/[nom]).
/// `masquerClient` retire la ligne client/site redondante quand le
/// client est déjà le titre de la page (on montre alors juste le site).
export function ListeRegistreDevis({
  lignes,
  masquerClient = false,
  isAdmin,
}: {
  lignes: DevisRegistreLigne[];
  masquerClient?: boolean;
  isAdmin: boolean;
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
            {isAdmin && d.montant !== null && <span>{eur(d.montant)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
