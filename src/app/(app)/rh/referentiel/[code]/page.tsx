import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REFERENTIELS, normaliserCle, type CodeReferentiel } from "@/lib/rh/referentiels";
import { chargerLignes, chargerOptions } from "../actions";
import { TableReferentiel } from "../table-referentiel";

export default async function ReferentielRhPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const { code } = await params;
  if (!(code in REFERENTIELS)) notFound();
  const def = REFERENTIELS[code as CodeReferentiel];
  const supabase = await createClient();
  const [lignes, options] = await Promise.all([chargerLignes(supabase, def.code), chargerOptions(supabase)]);

  // Barème : communes des sites sans tarif, et sites sans commune.
  let communesSansTarif: { commune: string; nb: number }[] = [];
  let sitesSansCommune: { id: string; nom: string; site: string }[] = [];
  if (def.code === "bareme") {
    const { data: sites } = await supabase.from("sites").select("id, nom, site, commune").order("nom");
    const tarifees = new Set(lignes.map((l) => normaliserCle(l.commune)));
    const compte = new Map<string, number>();
    for (const s of sites ?? []) {
      const c = (s.commune ?? "").trim();
      if (!c) sitesSansCommune.push({ id: s.id, nom: s.nom, site: s.site });
      else if (!tarifees.has(normaliserCle(c))) compte.set(c, (compte.get(c) ?? 0) + 1);
    }
    communesSansTarif = [...compte.entries()].map(([commune, nb]) => ({ commune, nb }));
    sitesSansCommune = sitesSansCommune.slice(0, 50);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{def.titre}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {def.description} — {lignes.length} ligne(s)
      </p>

      {(communesSansTarif.length > 0 || sitesSansCommune.length > 0) && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="mb-2 flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
            Communes à compléter
          </p>
          {communesSansTarif.length > 0 && (
            <p className="mb-1">
              <span className="font-semibold">Sans tarif dans le barème :</span>{" "}
              {communesSansTarif.map((c) => `${c.commune} (${c.nb} site${c.nb > 1 ? "s" : ""})`).join(", ")}. Ajoute-les avec le bouton « Ajouter ».
            </p>
          )}
          {sitesSansCommune.length > 0 && (
            <p>
              <span className="font-semibold">Sites sans commune ({sitesSansCommune.length}) :</span>{" "}
              {sitesSansCommune.map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", "}
                  <Link href={`/repertoire/clients/${s.id}/modifier`} className="underline hover:text-amber-700">
                    {[s.nom, s.site].filter(Boolean).join(" — ")}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      <TableReferentiel
        code={def.code}
        lignes={lignes}
        options={{ profils: options.profils, postes_absence: options.postes_absence, salaries_admin: options.salaries_admin, motifs: options.motifs }}
        communesSites={options.communesSites}
      />
    </div>
  );
}
