import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import { chargerRecapDepannages, type LigneRecap } from "@/lib/repertoire/recap";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [{ titre: "Statut" }, { titre: "Numéro" }, { titre: "Libellé" }];

export default async function DepannagesClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: site } = await supabase.from("sites_view").select("id, nom, site, hors_contrat").eq("id", id).single();
  if (!site) notFound();
  const s = site as Site;

  const recap = await chargerRecapDepannages([id]);
  const groupes: [string, LigneRecap[]][] = [
    ["En cours", recap.enCours],
    ["Traité", recap.traitees],
  ];
  const lignes = groupes.flatMap(([statut, l]) => l.map((ligne) => ({ statut, ligne })));

  return (
    <div>
      <FilAjouter
        maillons={[
          { nom: s.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${s.hors_contrat ? 1 : 0}` },
          { nom: s.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Dépannages" },
        ]}
      />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Dépannages</h1>
        <p className="text-sm text-slate-500">{[s.nom, s.site].filter(Boolean).join(" — ")} — {lignes.length} dépannage(s)</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map(({ statut, ligne }) => [
          statut,
          <Link key="numero" href={ligne.href} className="font-bold text-slate-900 hover:underline">
            {ligne.numero}
          </Link>,
          ligne.libelle,
        ])}
        valeurs={lignes.map(({ statut, ligne }) => [statut, ligne.numero, ligne.libelle])}
        vide="Aucun dépannage pour ce site"
      />
    </div>
  );
}
