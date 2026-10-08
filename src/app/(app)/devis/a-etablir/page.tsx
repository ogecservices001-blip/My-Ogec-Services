import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdminOuAccueil } from "@/lib/auth";
import { chargerDevisAEtablir } from "@/lib/bi/devis-a-etablir";
import { Tableur } from "@/components/tableur";
import { DevisEntete } from "../entete";

export default async function DevisAEtablirPage() {
  await requireAdminOuAccueil();
  const lignes = await chargerDevisAEtablir();

  return (
    <div>
      <DevisEntete isAdmin />
      <p className="mb-5 text-sm text-slate-500">
        Équipements signalés par un technicien, pas encore de devis créé.
      </p>
      <Tableur
        colonnes={[
          { titre: "Client — Site", largeur: "24%" },
          { titre: "Équipement", largeur: "20%" },
          { titre: "Compte rendu", largeur: "30%" },
          { titre: "N° BI", largeur: "12%" },
          { titre: "", largeur: "6%" },
        ]}
        lignes={lignes.map((l) => [
          [l.clientNom, l.site].filter(Boolean).join(" — "),
          l.equipementNom,
          l.compteRendu,
          l.biNumero,
          <Link
            key="creer"
            href={`/devis/nouveau?equipementId=${l.equipementId}&compteRendu=${encodeURIComponent(l.compteRendu)}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-green-dark hover:bg-green-50"
            title="Créer le devis"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Devis
          </Link>,
        ])}
        vide="Aucun devis à établir pour l'instant"
      />
    </div>
  );
}
