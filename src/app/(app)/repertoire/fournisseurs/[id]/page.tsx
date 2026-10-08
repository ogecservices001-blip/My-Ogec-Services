import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { Fournisseur } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { tvaSurFacture } from "@/lib/validation/fournisseur";
import { supprimerFournisseur } from "../actions";

export default async function FournisseurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const { data } = await supabase
    .from("fournisseurs")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const f = data as Fournisseur;
  const interlocuteurs = (f.interlocuteurs as unknown as Interlocuteur[] | null) ?? [];

  const champsTechnicien: [string, string][] = [
    ["Nature fourniture", f.nature_fourniture],
    ["Adresse", [f.adresse, f.complement_adresse].filter(Boolean).join(" — ")],
    ["Ville", [f.code_postal, f.commune].filter(Boolean).join(" ")],
  ];

  const champsAdmin: [string, string][] = [
    ["Dénomination courte", f.denomination_courte],
    ["Localisation", f.localisation],
    ["Site web", f.site_web],
    ["Produits clés", f.produits_cles],
    ["Remarques", f.remarques],
    ["Raison sociale exacte", f.raison_sociale_exacte],
    ["Forme juridique", f.forme_juridique],
    ["SIREN", f.siren],
    ["SIRET", f.siret],
    ["N° TVA intracom.", f.tva_intracom],
    ["RCS / RM", f.rcs_rm],
    ["TVA sur facture", tvaSurFacture(f.localisation)],
    ["Délai de paiement", f.delai_paiement],
    ["Mode de règlement", f.mode_reglement],
    ["CGV reçues", f.cgv_recues],
    ["Fiche mise à jour le", f.fiche_maj_le],
  ];

  return (
    <div>
      <Link
        href="/repertoire/fournisseurs"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
        {f.nom}
      </h1>
      {isAdmin && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/repertoire/fournisseurs/${id}/modifier`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
            Modifier
          </Link>
          <BoutonSupprimer
            action={supprimerFournisseur.bind(null, id)}
            confirmation={`Supprimer définitivement le fournisseur "${f.nom}" ? Cette action est irréversible.`}
            redirectTo="/repertoire/fournisseurs"
          />
        </div>
      )}

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Interlocuteurs
        </p>
        {interlocuteurs.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-300">Aucun interlocuteur renseigné</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {interlocuteurs.map((it, i) => (
              <li key={i} className="px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{it.nom || "—"}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {it.portable && (
                    <a href={`tel:${it.portable}`} className="inline-flex items-center gap-1.5 text-brand-green-dark hover:underline">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      {it.portable}
                    </a>
                  )}
                  {it.tel && (
                    <a href={`tel:${it.tel}`} className="inline-flex items-center gap-1.5 text-brand-green-dark hover:underline">
                      <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                      {it.tel}
                    </a>
                  )}
                  {it.email && (
                    <a href={`mailto:${it.email}`} className="hover:underline">
                      {it.email}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <dl>
          {[...champsTechnicien, ...(isAdmin ? champsAdmin : [])].map(([label, valeur], i) => (
            <div
              key={label}
              className={`flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-2 ${
                i > 0 ? "border-t border-slate-50" : ""
              }`}
            >
              <dt className="text-[13px] text-slate-500 sm:w-52 sm:shrink-0">
                {label}
              </dt>
              <dd
                className={
                  valeur
                    ? "text-sm font-medium text-slate-900"
                    : "text-sm text-slate-300"
                }
              >
                {valeur || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
