"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Tableur } from "@/components/tableur";
import { useFiltreClientSite } from "@/components/filtre-client-site";

export type DevisAEtablirLigne = {
  cle: string;
  client: string;
  site: string;
  equipement: string;
  compteRendu: string;
  biNumero: string;
  lien: string;
};

export function DevisAEtablirListe({ lignes }: { lignes: DevisAEtablirLigne[] }) {
  const { filtrees, bloc } = useFiltreClientSite(lignes, (l) => ({ client: l.client, site: l.site }), "devis-a-etablir");
  return (
    <>
      {bloc}
      <Tableur
        colonnes={[
          { titre: "Client — Site", largeur: "24%" },
          { titre: "Équipement", largeur: "20%" },
          { titre: "Compte rendu", largeur: "30%" },
          { titre: "N° BI", largeur: "12%" },
          { titre: "", largeur: "6%" },
        ]}
        lignes={filtrees.map((l) => [
          [l.client, l.site].filter(Boolean).join(" — "),
          l.equipement,
          l.compteRendu,
          l.biNumero,
          <Link
            key="creer"
            href={l.lien}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-green-dark hover:bg-green-50"
            title="Créer le devis"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Devis
          </Link>,
        ])}
        vide="Aucun devis à établir pour l'instant"
      />
    </>
  );
}
