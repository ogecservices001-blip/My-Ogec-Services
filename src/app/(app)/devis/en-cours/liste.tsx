"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Tableur } from "@/components/tableur";
import { useFiltreClientSite } from "@/components/filtre-client-site";
import { supprimerDevis } from "../actions";
import { SupprimerBrouillonBouton } from "./supprimer-brouillon-bouton";

export type DevisEnCoursLigne = { id: string; client: string; site: string; libelle: string; redacteur: string };

export function DevisEnCoursListe({ devis }: { devis: DevisEnCoursLigne[] }) {
  const { filtrees, bloc } = useFiltreClientSite(devis, (d) => ({ client: d.client, site: d.site }), "devis-en-cours");
  return (
    <>
      {bloc}
      <Tableur
        colonnes={[
          { titre: "Client", largeur: "22%" },
          { titre: "Site", largeur: "18%" },
          { titre: "Libellé", largeur: "28%" },
          { titre: "Rédacteur", largeur: "14%" },
          { titre: "", largeur: "18%" },
        ]}
        lignes={filtrees.map((d) => [
          d.client,
          d.site,
          d.libelle || "(sans libellé)",
          d.redacteur,
          <div key="actions" className="flex justify-end gap-1">
            <Link
              href={`/devis/nouveau?brouillonId=${d.id}`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-green-dark hover:bg-green-50"
              title="Reprendre"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
              Reprendre
            </Link>
            <SupprimerBrouillonBouton id={d.id} supprimer={supprimerDevis} />
          </div>,
        ])}
        vide="Aucun devis en cours pour l'instant"
      />
    </>
  );
}
