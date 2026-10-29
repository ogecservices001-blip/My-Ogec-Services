import { notFound } from "next/navigation";
import { CalendarDays, User, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FilAjouter } from "@/components/fil-extra-context";
import type { Equipement, TypeEquipement, Releve } from "@/lib/gmao/types";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default async function HistoriqueRelevesPage({
  params,
}: {
  params: Promise<{ id: string; equipementId: string }>;
}) {
  const { id, equipementId } = await params;
  const supabase = await createClient();

  const [{ data: site }, { data: eqData }, { data: relevesData, error }] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").eq("id", id).single(),
    supabase.from("equipements").select("*").eq("id", equipementId).eq("site_id", id).single(),
    supabase.from("releves").select("*").eq("equipement_id", equipementId).order("date", { ascending: false }),
  ]);
  if (!site || !eqData) notFound();
  const equipement = eqData as Equipement;
  if (error) throw new Error(error.message);

  const { data: typeData } = await supabase
    .from("types_equipement")
    .select("*")
    .eq("id", equipement.type_equipement_id)
    .single();
  if (!typeData) notFound();
  const type = typeData as TypeEquipement;
  const releves = (relevesData ?? []) as Releve[];

  return (
    <div>
      <FilAjouter maillons={[{ nom: equipement.nom }, { nom: "Historique" }]} />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Historique — {equipement.nom}</h1>
      <p className="mb-5 text-sm text-slate-500">{releves.length} visite(s) enregistrée(s)</p>

      {releves.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucune visite enregistrée pour cet équipement</p>
      ) : (
        <div>
          {releves.map((releve) => (
            <CarteReleve key={releve.id} releve={releve} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

function CarteReleve({ releve, type }: { releve: Releve; type: TypeEquipement }) {
  const remarques: [string, string][] = [
    ["Remarque 1", releve.remarque1],
    ["Remarque 2", releve.remarque2],
    ["Informations internes", releve.informations_internes],
  ].filter(([, v]) => v.trim().length > 0) as [string, string][];

  const anomalies: [string, string][] = [];
  const normaux: [string, string][] = [];
  for (const item of type.checklist) {
    const valeur = releve.checklist_values[String(item.rep)];
    if (valeur === undefined || valeur === null || valeur === "") continue;
    const texte = typeof valeur === "boolean" ? (valeur ? "Effectué" : "Non") : valeur;
    if (item.typeValeur === "enum" && item.options.length > 0 && texte !== item.options[0]) {
      anomalies.push([item.label, texte]);
    } else {
      normaux.push([item.label, texte]);
    }
  }

  const mesures: [string, [string, string][]][] = [];
  for (const groupe of type.groupes_mesures) {
    const occurrences = releve.groupes_mesures[groupe.cle];
    if (!occurrences) continue;
    occurrences.forEach((valeurs, i) => {
      const entrees: [string, string][] = [];
      for (const champ of groupe.champs) {
        const v = valeurs[champ.cle];
        if (!v || !v.trim()) continue;
        entrees.push([champ.unite ? `${champ.label} (${champ.unite})` : champ.label, v]);
      }
      if (entrees.length > 0) {
        mesures.push([groupe.repetable ? `${groupe.label} ${i + 1}` : groupe.label, entrees]);
      }
    });
  }

  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <CalendarDays className="h-4 w-4 text-teal-600" strokeWidth={2} />
          {formaterDate(releve.date)}
        </span>
        {releve.nom_tech && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <User className="h-3.5 w-3.5" strokeWidth={2} />
            {releve.nom_tech}
          </span>
        )}
        {releve.validation_fonctionnement && (
          <span
            className={`ml-auto text-xs font-semibold ${
              releve.validation_fonctionnement === "Fonctionnel" ? "text-brand-green-dark" : "text-orange-700"
            }`}
          >
            {releve.validation_fonctionnement}
          </span>
        )}
      </div>

      {anomalies.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-orange-800">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
            Points signalés
          </p>
          {anomalies.map(([label, valeur]) => (
            <p key={label} className="text-sm font-semibold text-orange-900">
              {label} : {valeur}
            </p>
          ))}
        </div>
      )}

      {remarques.length > 0 && (
        <div className="mt-3 space-y-1">
          {remarques.map(([label, valeur]) => (
            <p key={label} className="text-sm text-slate-800">
              <span className="font-semibold">{label} : </span>
              {valeur}
            </p>
          ))}
        </div>
      )}

      {mesures.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-slate-600">Mesures</summary>
          <div className="mt-2 space-y-2">
            {mesures.map(([titre, entrees]) => (
              <div key={titre}>
                <p className="text-xs font-bold text-teal-700">{titre}</p>
                {entrees.map(([label, valeur]) => (
                  <p key={label} className="text-xs text-slate-600">
                    <span className="font-semibold">{label} : </span>
                    {valeur}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {normaux.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-slate-600">Détail checklist</summary>
          <div className="mt-2 space-y-0.5">
            {normaux.map(([label, valeur]) => (
              <p key={label} className="text-xs text-slate-600">
                <span className="font-semibold">{label} : </span>
                {valeur}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
