import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, FileText } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { labelNatureDevis } from "@/lib/devis/constants";
import { pavesDuDevis } from "@/lib/devis/paves";
import type { LigneCommande } from "@/lib/commandes-fournisseur/format";

/// Devis vu par le technicien depuis son planning : travaux et matériel,
/// commandes, sans aucun prix ni montant. Accessible seulement pour un devis
/// planifié sur un de ses créneaux (le bureau voit tout).
export default async function DevisTechnicienPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "technicien") notFound();
  const { id } = await params;
  const supabase = await createClient();

  if (profile.role !== "admin") {
    const { count } = await supabase
      .from("creneau_techniciens")
      .select("creneau_id, creneaux_planning!inner(devis_id)", { count: "exact", head: true })
      .eq("technicien_id", profile.id)
      .eq("creneaux_planning.devis_id", id);
    if (!count) notFound();
  }

  const { data: devis } = await supabase
    .from("devis")
    .select(
      "id, numero, site_id, nature, libelle, localisation, paves, lignes, equipement_id, equipements_supplementaires, heures_prevues, date_commande_client, reference_client, date_mise_a_disposition_fourniture",
    )
    .eq("id", id)
    .single();
  if (!devis) notFound();

  const [{ data: site }, { data: commandes }] = await Promise.all([
    supabase.from("sites").select("nom, site").eq("id", devis.site_id).single(),
    supabase
      .from("commandes_fournisseur")
      .select("id, numero, fournisseur_id, date_commande, date_livraison_prevue, livre, lignes")
      .eq("devis_id", id)
      .order("created_at"),
  ]);
  const paves = pavesDuDevis(devis);
  const equipementIds = [...new Set(paves.map((p) => p.equipementId).filter((x): x is string => Boolean(x)))];
  const fournisseurIds = [...new Set((commandes ?? []).map((c) => c.fournisseur_id))];
  const [{ data: equipements }, { data: fournisseurs }] = await Promise.all([
    equipementIds.length
      ? supabase.from("equipements").select("id, nom, numero_equipement").in("id", equipementIds)
      : Promise.resolve({ data: [] as { id: string; nom: string; numero_equipement: string }[] }),
    fournisseurIds.length
      ? supabase.from("fournisseurs").select("id, nom").in("id", fournisseurIds)
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
  ]);
  const nomEquipement = (id: string | null) => {
    const e = (equipements ?? []).find((x) => x.id === id);
    return e ? [e.nom, e.numero_equipement].filter(Boolean).join(" — ") : "";
  };
  const nomFournisseur = (id: string) => (fournisseurs ?? []).find((f) => f.id === id)?.nom ?? "";

  const infos: [string, string][] = [
    ["Client", [site?.nom, site?.site].filter(Boolean).join(" — ")],
    ["Nature", labelNatureDevis(devis.nature)],
    ["Objet", devis.libelle],
    ["Localisation", devis.localisation],
    ["Heures prévues", devis.heures_prevues ? `${String(devis.heures_prevues).replace(".", ",")} h` : ""],
    ["Commande client", [devis.date_commande_client && `le ${devis.date_commande_client}`, devis.reference_client].filter(Boolean).join(" — ")],
    ["Mise à disposition fourniture", devis.date_mise_a_disposition_fourniture],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/planning/mon-planning"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Mon planning
      </Link>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
        <FileText className="h-6 w-6 text-brand-green" strokeWidth={2} />
        Devis {devis.numero || "(sans référence)"}
      </h1>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {infos
            .filter(([, v]) => v)
            .map(([label, valeur]) => (
              <div key={label} className="py-1 text-sm">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-800">{valeur}</dd>
              </div>
            ))}
        </dl>
      </div>

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Travaux et matériel</h2>
      <div className="mb-5 space-y-3">
        {paves.map((p, i) => {
          const lignes = p.lignes.filter((l) => l.designation.trim());
          return (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm">
              {(nomEquipement(p.equipementId) || p.equipementNom || p.localisation) && (
                <p className="mb-1 text-sm font-bold text-slate-900">
                  {nomEquipement(p.equipementId) || p.equipementNom}
                  {p.localisation && <span className="font-normal text-slate-500"> — {p.localisation}</span>}
                </p>
              )}
              {p.libelle && paves.length > 1 && <p className="mb-2 text-sm text-slate-600">{p.libelle}</p>}
              {lignes.length === 0 ? (
                <p className="text-sm text-slate-400">Pas de détail de lignes.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {lignes.map((l, j) => (
                    <li key={j} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="text-slate-800">{l.designation}</span>
                      <span className="shrink-0 font-semibold text-slate-600">
                        {l.quantite} {l.unite}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Commandes fournisseur</h2>
      {(commandes ?? []).length === 0 ? (
        <p className="mb-5 rounded-2xl bg-white p-4 text-sm text-slate-400 shadow-sm">Aucune commande fournisseur pour ce devis.</p>
      ) : (
        <div className="mb-5 space-y-3">
          {(commandes ?? []).map((c) => {
            const lignes = ((c.lignes as LigneCommande[] | null) ?? []).filter((l) => l.designation.trim() || l.code.trim());
            return (
              <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Package className="h-4 w-4 text-slate-400" strokeWidth={2} />
                    {c.numero} — {nomFournisseur(c.fournisseur_id)}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.livre ? "bg-brand-green/15 text-brand-green-dark" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {c.livre ? "Livré" : c.date_livraison_prevue ? `Livraison prévue ${c.date_livraison_prevue}` : "Pas encore livré"}
                  </span>
                </div>
                {c.date_commande && <p className="mb-1 text-xs text-slate-400">Commandé le {c.date_commande}</p>}
                <ul className="divide-y divide-slate-100">
                  {lignes.map((l, j) => (
                    <li key={j} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <span className="text-slate-800">
                        {l.code && <span className="mr-1.5 text-xs text-slate-400">{l.code}</span>}
                        {l.designation}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-600">× {l.quantite}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
