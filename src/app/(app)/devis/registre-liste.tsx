import Link from "next/link";
import { Tableur } from "@/components/tableur";
import { calculerStatutDevis, LABEL_STATUT_DEVIS, TEINTE_STATUT_DEVIS } from "./statut";

export type DevisRegistreLigne = {
  id: string;
  numero: string;
  clientNom: string;
  clientSite: string;
  redacteur: string;
  libelle: string;
  nature: string;
  montant: number | null;
  dateDevis: string;
  commande: boolean;
  realise: boolean;
  facturable: boolean;
  annule: boolean;
};

export function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/// "D-26-279-BG-405-01-30" → "D-26-279" — seules les 3 premières
/// parties (type-année-chrono) comptent pour reconnaître un devis au
/// coup d'œil, le reste (rédacteur, affaire, pôle) alourdit la colonne
/// sans apporter d'info utile dans ce tableau.
export function numeroCourt(numero: string): string {
  return numero.split("-").slice(0, 3).join("-");
}

const TEINTE_STATUT = (d: DevisRegistreLigne) => TEINTE_STATUT_DEVIS[calculerStatutDevis(d)];
const LABEL_STATUT = (d: DevisRegistreLigne) => LABEL_STATUT_DEVIS[calculerStatutDevis(d)];

/// Présentation "intelligente" du Chrono Devis (/devis) : une ligne par
/// devis, colonnes Référence/Client/Site/Rédacteur/Date/Libellé/Montant
/// + Statut — via le composant Tableur partagé (tableau bureau, cartes
/// mobile, cohérent avec le reste de l'appli).
export function TableauRegistreDevis({ lignes, isAdmin }: { lignes: DevisRegistreLigne[]; isAdmin: boolean }) {
  const totalMontant = lignes.filter((l) => !l.annule).reduce((s, l) => s + (l.montant ?? 0), 0);

  return (
    <Tableur
      colonnes={[
        { titre: "Référence devis", largeur: "12%" },
        { titre: "Client", largeur: "16%" },
        { titre: "Site", largeur: "14%" },
        { titre: "Rédacteur", largeur: "10%" },
        { titre: "Date devis", largeur: "9%" },
        { titre: "Pôle", largeur: "6%" },
        { titre: "Libellé", largeur: "19%" },
        ...(isAdmin ? [{ titre: "Montant", largeur: "10%", droite: true }] : []),
        { titre: "Statut", largeur: "10%" },
      ]}
      lignes={lignes.map((d) => [
        d.numero ? (
          <Link key="numero" href={`/devis/${d.id}/statut`} className="font-semibold text-slate-900 hover:underline">
            {numeroCourt(d.numero)}
          </Link>
        ) : (
          "—"
        ),
        d.clientNom,
        d.clientSite,
        d.redacteur,
        d.dateDevis,
        d.nature,
        d.libelle,
        ...(isAdmin ? [d.montant !== null ? eur(d.montant) : ""] : []),
        isAdmin ? (
          <Link
            key="statut"
            href={`/devis/${d.id}/statut`}
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition hover:opacity-75 ${TEINTE_STATUT(d)}`}
          >
            {LABEL_STATUT(d)}
          </Link>
        ) : (
          <span key="statut" className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TEINTE_STATUT(d)}`}>
            {LABEL_STATUT(d)}
          </span>
        ),
      ])}
      pied={isAdmin ? ["Total", "", "", "", "", "", "", eur(totalMontant), ""] : undefined}
      valeurs={lignes.map((d) => {
        // Statut affiché en pastille : son libellé sert de valeur de filtre.
        const v: (string | undefined)[] = [d.numero || "(sans référence)", d.clientNom, d.clientSite];
        v[isAdmin ? 8 : 7] = LABEL_STATUT(d);
        return v;
      })}
      vide="Aucun devis pour l'instant"
    />
  );
}

