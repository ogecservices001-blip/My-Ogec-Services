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
          { titre: "Client — Site", largeur: "26%" },
          { titre: "Équipement", largeur: "22%" },
          { titre: "Compte rendu", largeur: "32%" },
          { titre: "N° BI", largeur: "12%" },
        ]}
        lignes={lignes.map((l) => [
          [l.clientNom, l.site].filter(Boolean).join(" — "),
          l.equipementNom,
          l.compteRendu,
          l.biNumero,
        ])}
        vide="Aucun devis à établir pour l'instant"
      />
    </div>
  );
}
