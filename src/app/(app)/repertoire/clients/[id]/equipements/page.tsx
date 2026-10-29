import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import type { Equipement } from "@/lib/gmao/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Groupe" },
  { titre: "Nom" },
  { titre: "N° équipement" },
  { titre: "Localisation" },
];

/// Vue simple et rapide du parc d'un client, côté Répertoire — juste ce
/// qui est physiquement installé (nom, numéro, localisation), sans les
/// heures ni les actions de gestion (ajout, QR, relevé, import/export),
/// qui vivent dans le module GMAO (/gmao). Sert la consultation rapide
/// depuis la fiche client, pas le pilotage de l'entretien.
export default async function EquipementsClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: equipements }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("site_id", id).order("nom"),
  ]);
  if (!site) notFound();

  const liste = (equipements ?? []) as Equipement[];
  const lignes = liste
    .map((eq) => ({ groupe: eq.groupe.trim() || "Sans groupe", eq }))
    .sort((a, b) => a.groupe.localeCompare(b.groupe, "fr") || a.eq.nom.localeCompare(b.eq.nom, "fr"));

  return (
    <div>
      <FilAjouter
        maillons={[
          { nom: site.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(site.nom)}?horsContrat=${site.hors_contrat ? 1 : 0}` },
          { nom: site.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Équipements" },
        ]}
      />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Équipements client</h1>
      <p className="mb-5 text-sm text-slate-500">
        {[site.nom, site.site].filter(Boolean).join(" — ")} — {liste.length} équipement(s)
      </p>

      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map(({ groupe, eq }) => [groupe, eq.nom, eq.numero_equipement, eq.localisation])}
        valeurs={lignes.map(({ groupe, eq }) => [groupe, eq.nom, eq.numero_equipement, eq.localisation])}
        vide="Aucun équipement enregistré pour ce client"
      />
    </div>
  );
}
