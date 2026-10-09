"use client";

import { useState } from "react";
import Link from "next/link";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FiltreSelect } from "@/components/filtre-select";
import { labelNatureDevis } from "@/lib/devis/constants";
import { eur, numeroCourt, type DevisRegistreLigne } from "../../registre-liste";
import { calculerStatutDevis, LABEL_STATUT_DEVIS, TEINTE_STATUT_DEVIS } from "../../statut";

const COLONNES: ColonneTableur[] = [
  { titre: "N°", largeur: "10%" },
  { titre: "Site", largeur: "16%" },
  { titre: "Libellé", largeur: "30%" },
  { titre: "Nature", largeur: "8%" },
  { titre: "Date devis", largeur: "9%" },
  { titre: "Montant", largeur: "11%", droite: true },
  { titre: "Statut", largeur: "12%" },
];

export function TableauGroupe({ lignes }: { lignes: DevisRegistreLigne[] }) {
  const [statut, setStatut] = useState("");
  const filtres = lignes.filter((d) => !statut || calculerStatutDevis(d) === statut);
  const totalMontant = filtres.filter((d) => !d.annule).reduce((s, d) => s + (d.montant ?? 0), 0);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <FiltreSelect
          valeur={statut}
          onChange={setStatut}
          toutes="Tous les statuts"
          options={[
            { valeur: "realise", label: "Réalisé" },
            { valeur: "commande", label: "Commandé" },
            { valeur: "attente", label: "En attente" },
            { valeur: "annule", label: "Annulée" },
          ]}
        />
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={filtres.map((d) => {
          const s = calculerStatutDevis(d);
          return [
            numeroCourt(d.numero) || "—",
            d.clientSite || "—",
            d.libelle,
            labelNatureDevis(d.nature) || "—",
            d.dateDevis,
            d.montant !== null ? eur(d.montant) : "",
            <Link
              key="statut"
              href={`/devis/${d.id}/statut`}
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition hover:opacity-75 ${TEINTE_STATUT_DEVIS[s]}`}
            >
              {LABEL_STATUT_DEVIS[s]}
            </Link>,
          ];
        })}
        valeurs={filtres.map((d) => [undefined, undefined, undefined, undefined, undefined, undefined, LABEL_STATUT_DEVIS[calculerStatutDevis(d)]])}
        pied={["Total", "", "", "", "", eur(totalMontant), ""]}
        vide="Aucun devis ne correspond à ce filtre"
      />
    </>
  );
}
