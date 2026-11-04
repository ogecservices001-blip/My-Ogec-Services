import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOuAccueil } from "@/lib/auth";
import type { Site } from "@/lib/types";
import { Tableur } from "@/components/tableur";
import { DevisEntete } from "../entete";
import { supprimerDevis } from "../actions";
import { SupprimerBrouillonBouton } from "./supprimer-brouillon-bouton";

export default async function DevisEnCoursPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const [{ data: devis }, { data: sites }] = await Promise.all([
    supabase.from("devis").select("*").eq("numero", "").order("updated_at", { ascending: false }),
    supabase.from("sites_view").select("*"),
  ]);
  const siteParId = new Map(((sites ?? []) as Site[]).map((s) => [s.id, s]));

  return (
    <div>
      <DevisEntete isAdmin />
      <p className="mb-5 text-sm text-slate-500">
        Devis enregistrés incomplets depuis &quot;Nouveau devis&quot; — pas encore de numéro officiel attribué.
      </p>
      <Tableur
        colonnes={[
          { titre: "Client", largeur: "22%" },
          { titre: "Site", largeur: "18%" },
          { titre: "Libellé", largeur: "28%" },
          { titre: "Rédacteur", largeur: "14%" },
          { titre: "", largeur: "18%" },
        ]}
        lignes={(devis ?? []).map((d) => {
          const site = siteParId.get(d.site_id);
          return [
            site?.nom ?? "",
            site?.site ?? "",
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
          ];
        })}
        vide="Aucun devis en cours pour l'instant"
      />
    </div>
  );
}
