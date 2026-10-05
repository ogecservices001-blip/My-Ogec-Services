import Link from "next/link";
import { Building2, Building, Download, Upload, ChevronRight, ScanLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { sommeHeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";
import { supprimerEquipementsPourSites } from "./actions";

function fmt(h: { heuresTech: number; heuresAssistant: number }): string {
  return `${h.heuresTech}h Tech / ${h.heuresAssistant}h Assistant`;
}

export default async function GmaoHomePage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const [{ count: nbContrat }, { count: nbHorsContrat }, equipements, { data: references }, { data: sites }] =
    await Promise.all([
      supabase.from("sites_view").select("*", { count: "exact", head: true }).eq("hors_contrat", false),
      supabase.from("sites_view").select("*", { count: "exact", head: true }).eq("hors_contrat", true),
      recupererToutesLesLignes<Equipement>((debut, fin) =>
        supabase.from("equipements").select("*").range(debut, fin),
      ),
      supabase.from("references_horaires").select("*"),
      supabase.from("sites").select("id"),
    ]);

  const listeEquipements = equipements;
  const freqCouranteParEquipement = await freqCouranteCalculeeBatch(
    supabase,
    listeEquipements.map((e) => e.id),
  );
  const heures = sommeHeuresAnnee(
    listeEquipements,
    (references ?? []) as ReferenceHoraire[],
    freqCouranteParEquipement,
  );
  const tousLesSiteIds = (sites ?? []).map((s) => s.id);

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">GMAO</h1>
          <p className="text-sm text-slate-500">Parc équipements et relevés d&apos;entretien</p>
        </div>
        <Link
          href="/gmao/scanner"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
        >
          <ScanLine className="h-4 w-4" strokeWidth={2.25} />
          Scanner
        </Link>
      </div>

      <div className="space-y-3">
        <Link
          href="/gmao/clients?horsContrat=0"
          className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100">
            <Building2 className="h-5 w-5 text-brand-green-dark" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">Clients sous contrat</span>
            <span className="block text-sm text-slate-500">{nbContrat ?? 0} site(s)</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>
        <Link
          href="/gmao/clients?horsContrat=1"
          className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100">
            <Building className="h-5 w-5 text-orange-600" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-900">Clients hors contrat</span>
            <span className="block text-sm text-slate-500">{nbHorsContrat ?? 0} site(s)</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </Link>
      </div>

      {(heures.prevues.heuresTech > 0 || heures.prevues.heuresAssistant > 0) && (
        <div className="mt-4 rounded-2xl bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-800">Heures prévues (tous clients) : {fmt(heures.prevues)}</p>
          <p className="mt-1 text-xs text-brand-green-dark">Effectuées : {fmt(heures.effectuees)}</p>
          <p className="text-xs text-orange-700">Restant à faire : {fmt(heures.restantes)}</p>
        </div>
      )}

      {isAdmin && (
        <>
          <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
            Global — tous clients
          </p>
          <div className="space-y-2">
            <a
              href="/gmao/export"
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4 text-slate-400" strokeWidth={2} />
              Exporter tous les équipements
            </a>
            <Link
              href="/gmao/importer"
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Upload className="h-4 w-4 text-slate-400" strokeWidth={2} />
              Importer des équipements
            </Link>
            {tousLesSiteIds.length > 0 && (
              <BoutonSupprimer
                action={supprimerEquipementsPourSites.bind(null, tousLesSiteIds)}
                confirmation="Supprime tous les équipements de tous les clients, tous sites confondus — action irréversible."
                redirectTo="/gmao"
                label="Supprimer tous les équipements"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
