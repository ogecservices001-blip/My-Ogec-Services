import Link from "next/link";
import { Plus, Upload, Download, FileSignature, ClipboardList, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { FilAjouter } from "@/components/fil-extra-context";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { Site } from "@/lib/types";
import { supprimerSitesDuClient } from "../../actions";

const COLONNES: ColonneTableur[] = [
  { titre: "Lots" },
  { titre: "Adresse" },
  { titre: "CP", largeur: "90px" },
  { titre: "Commune" },
  { titre: "N° affaire", largeur: "110px" },
];

export default async function SitesDuClientPage({
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

  return (
    <div>
      <FilAjouter maillons={[{ nom: nomDecode }]} />
      <div className="mb-4 flex items-center justify-end">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href={`/repertoire/clients/groupe/${encodeURIComponent(nomDecode)}/export${horsContrat ? "?horsContrat=1" : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter les sites de ce client"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/repertoire/clients/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer un fichier"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href={`/repertoire/clients/nouveau${horsContrat ? "?horsContrat=1" : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Ajouter un site
            </Link>
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {nomDecode}
      </h1>
      <p className="mb-3 text-sm text-slate-500">{sites.length} site(s)</p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`/repertoire/clients/groupe/${nom}/devis?horsContrat=${horsContrat ? 1 : 0}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileSignature className="h-4 w-4" strokeWidth={2} />
          Devis
        </Link>
        <Link
          href={`/repertoire/clients/groupe/${nom}/bon-intervention?horsContrat=${horsContrat ? 1 : 0}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ClipboardList className="h-4 w-4" strokeWidth={2} />
          Bon d&apos;intervention
        </Link>
        <Link
          href={`/repertoire/clients/groupe/${nom}/depannages?horsContrat=${horsContrat ? 1 : 0}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Zap className="h-4 w-4" strokeWidth={2} />
          Dépannages
        </Link>
        {isAdmin && sites.length > 0 && (
          <BoutonSupprimer
            action={supprimerSitesDuClient.bind(null, nomDecode)}
            confirmation={`Supprimer définitivement les ${sites.length} site(s) de ${nomDecode} ? Cette action est irréversible.`}
            redirectTo={`/repertoire/clients${horsContrat ? "?horsContrat=1" : ""}`}
            label="Supprimer tous les sites de ce client"
          />
        )}
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={sites.map((s) => [
          <Link key="site" href={`/repertoire/clients/${s.id}`} className="font-bold text-slate-900 hover:underline">
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
    </div>
  );
}
