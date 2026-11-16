import { requireAdminOuAccueil } from "@/lib/auth";
import { chargerDevisAEtablir, lienCreerDevis } from "@/lib/bi/devis-a-etablir";
import { DevisEntete } from "../entete";
import { DevisAEtablirListe } from "./liste";

export default async function DevisAEtablirPage() {
  await requireAdminOuAccueil();
  const lignes = await chargerDevisAEtablir();

  return (
    <div>
      <DevisEntete isAdmin />
      <p className="mb-5 text-sm text-slate-500">
        Équipements signalés par un technicien, pas encore de devis créé.
      </p>
      <DevisAEtablirListe
        lignes={lignes.map((l) => ({
          cle: l.biNumero,
          client: l.clientNom,
          site: l.site,
          equipement: l.equipementNom,
          compteRendu: l.compteRendu,
          biNumero: l.biNumero,
          lien: lienCreerDevis(l),
        }))}
      />
    </div>
  );
}
