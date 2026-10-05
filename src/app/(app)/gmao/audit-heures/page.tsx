import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Site } from "@/lib/types";
import type { Equipement, ReferenceHoraire } from "@/lib/gmao/types";
import { freqCouranteCalculeeBatch } from "@/lib/gmao/releve-service";
import { sommeHeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { extraireNumero } from "@/lib/gmao/equipement-import";
import { recupererToutesLesLignes } from "@/lib/supabase/pagination";

function fmtH(h: number): string {
  return h.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default async function AuditHeuresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: sitesData } = await supabase.from("sites_view").select("*").eq("hors_contrat", false);
  const sites = (sitesData ?? []) as Site[];
  const siteIds = sites.map((s) => s.id);

  const [equipements, { data: references }] = await Promise.all([
    recupererToutesLesLignes<Equipement>((debut, fin) =>
      supabase.from("equipements").select("*").in("site_id", siteIds).range(debut, fin),
    ),
    supabase.from("references_horaires").select("*"),
  ]);

  const freqCouranteParEquipement = await freqCouranteCalculeeBatch(
    supabase,
    equipements.map((e) => e.id),
  );

  const equipementsParSite = new Map<string, Equipement[]>();
  for (const eq of equipements) {
    const liste = equipementsParSite.get(eq.site_id) ?? [];
    liste.push(eq);
    equipementsParSite.set(eq.site_id, liste);
  }

  const lignes = sites
    .map((s) => {
      const heures = sommeHeuresAnnee(
        equipementsParSite.get(s.id) ?? [],
        (references ?? []) as ReferenceHoraire[],
        freqCouranteParEquipement,
      );
      const parts = s.n_affaire.split("-");
      const numClient = extraireNumero(parts[0] ?? "") ?? Number.MAX_SAFE_INTEGER;
      const numSite = extraireNumero(parts.slice(1).join("-") ?? "") ?? Number.MAX_SAFE_INTEGER;
      return {
        id: s.id,
        numero: s.n_affaire,
        clientNom: s.nom,
        clientSite: s.site,
        heuresTech: heures.prevues.heuresTech,
        heuresAssistant: heures.prevues.heuresAssistant,
        numClient,
        numSite,
      };
    })
    .sort((a, b) => a.numClient - b.numClient || a.numSite - b.numSite);

  const totalTech = lignes.reduce((s, l) => s + l.heuresTech, 0);
  const totalAssistant = lignes.reduce((s, l) => s + l.heuresAssistant, 0);

  return (
    <div>
      <Link
        href="/gmao"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Audit Heures — Clients sous contrat
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Heures prévues sur l&apos;année, par site, classées par numéro de client et de site
      </p>

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-slate-900">{lignes.length}</p>
          <p className="text-xs text-slate-500">Sites</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-teal-700">{fmtH(totalTech)} h</p>
          <p className="text-xs text-slate-500">Total Technicien</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-lg font-bold text-sky-700">{fmtH(totalAssistant)} h</p>
          <p className="text-xs text-slate-500">Total Assistant</p>
        </div>
      </div>

      {lignes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun site sous contrat pour l&apos;instant</p>
      ) : (
        <ul className="space-y-2.5">
          {lignes.map((l) => (
            <li key={l.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-bold text-slate-900">{l.numero || "(sans numéro)"}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">
                {[l.clientNom, l.clientSite].filter(Boolean).join(" — ")}
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                {fmtH(l.heuresTech)} h Technicien · {fmtH(l.heuresAssistant)} h Assistant
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
