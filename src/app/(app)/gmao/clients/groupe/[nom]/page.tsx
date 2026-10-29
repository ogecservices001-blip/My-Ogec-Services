import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { supprimerEquipementsPourSites } from "@/app/(app)/gmao/actions";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Lots" },
  { titre: "Adresse" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "N° affaire", largeur: "110px" },
];

export default async function GmaoSitesDuClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ nom: string }>;
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const { data } = await supabase
    .from("sites_view")
    .select("*")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat)
    .order("site");
  const sites = (data as Site[]) ?? [];
  const siteIds = sites.map((s) => s.id);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        {isAdmin && siteIds.length > 0 && (
          <div className="flex items-center gap-2">
            <a
              href={`/gmao/clients/groupe/${nom}/export`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter tous les équipements de ce client"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href={`/gmao/clients/groupe/${nom}/importer?horsContrat=${horsContrat ? "1" : "0"}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer des équipements pour ce client"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{nomDecode}</h1>
      <p className="mb-5 text-sm text-slate-500">{sites.length} site(s)</p>

      <Tableur
        colonnes={COLONNES}
        lignes={sites.map((s) => [
          <Link key="site" href={`/gmao/clients/${s.id}/equipements`} className="font-bold text-slate-900 hover:underline">
            {s.site || "Site sans nom"}
          </Link>,
          s.adresse,
          s.code_postal,
          s.commune,
          s.n_affaire,
        ])}
        valeurs={sites.map((s) => [s.site, s.adresse, s.code_postal, s.commune, s.n_affaire])}
        vide="Aucun site pour ce client"
      />

      {isAdmin && siteIds.length > 0 && (
        <div className="mt-6">
          <BoutonSupprimer
            action={supprimerEquipementsPourSites.bind(null, siteIds)}
            confirmation={`Supprime tous les équipements de tous les sites de "${nomDecode}" (${sites.length} site(s)) — action irréversible.`}
            redirectTo={`/gmao/clients/groupe/${nom}?horsContrat=${horsContrat ? "1" : "0"}`}
            label="Supprimer tous les équipements de ce client"
          />
        </div>
      )}
    </div>
  );
}
