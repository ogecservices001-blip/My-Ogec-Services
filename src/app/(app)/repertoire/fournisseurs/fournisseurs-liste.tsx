"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  ChevronDown,
  Truck,
  Plus,
  Upload,
  Download,
  Phone,
} from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { Fournisseur } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";

function interlocuteursDe(f: Fournisseur): Interlocuteur[] {
  return (f.interlocuteurs as unknown as Interlocuteur[] | null) ?? [];
}

export function FournisseursListe({
  fournisseurs,
  isAdmin,
}: {
  fournisseurs: Fournisseur[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [nature, setNature] = useState("");
  const [localisation, setLocalisation] = useState("");

  const natures = useMemo(
    () => [...new Set(fournisseurs.map((f) => f.nature_fourniture).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [fournisseurs],
  );

  const filtres = useMemo(
    () =>
      fournisseurs.filter((f) => {
        if (nature && f.nature_fourniture !== nature) return false;
        if (localisation && f.localisation !== localisation) return false;
        const cible = recherche.toLowerCase();
        return (
          f.nom.toLowerCase().includes(cible) ||
          f.commune.toLowerCase().includes(cible) ||
          f.nature_fourniture.toLowerCase().includes(cible)
        );
      }),
    [fournisseurs, recherche, nature, localisation],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/repertoire"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier, pas une page interne */}
            <a
              href="/repertoire/fournisseurs/export"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter en Excel"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/repertoire/fournisseurs/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer un fichier"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
            <Link
              href="/repertoire/fournisseurs/nouveau"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Ajouter
            </Link>
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Fournisseurs
      </h1>
      <p className="mb-5 text-sm text-slate-500">{filtres.length} fournisseur(s)</p>

      <div className="mb-4 flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Rechercher un fournisseur..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
        </div>
        <select
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        >
          <option value="">Toutes les natures</option>
          {natures.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            value={localisation}
            onChange={(e) => setLocalisation(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          >
            <option value="">Toutes localisations</option>
            <option value="Réunion">Réunion</option>
            <option value="Métropole">Métropole</option>
          </select>
        )}
      </div>

      {isAdmin ? <VueAdmin fournisseurs={filtres} /> : <VueTechnicien fournisseurs={filtres} />}
    </div>
  );
}

/// Vue technicien : cartes repliables, pensées pour appeler vite depuis
/// le terrain (mêmes tel:/mailto: que l'annuaire Collaborateurs) — pas
/// de tableau brut ni de champ à saisir.
function VueTechnicien({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);

  if (fournisseurs.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Aucun fournisseur trouvé</p>;
  }

  return (
    <ul className="space-y-3">
      {fournisseurs.map((f) => {
        const interlocuteurs = interlocuteursDe(f);
        return (
          <li key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <button
              onClick={() => setOuvert(ouvert === f.id ? null : f.id)}
              className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100">
                <Truck className="h-5 w-5 text-sky-600" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{f.nom}</p>
                {f.nature_fourniture && (
                  <p className="truncate text-xs text-slate-400">{f.nature_fourniture}</p>
                )}
              </div>
              <span className="shrink-0 text-sm text-slate-400">{f.commune}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-300 transition ${ouvert === f.id ? "rotate-180" : ""}`}
              />
            </button>
            {ouvert === f.id && (
              <div className="space-y-3 border-t border-slate-50 bg-slate-50/50 px-4 py-3">
                {(f.adresse || f.complement_adresse) && (
                  <p className="text-sm text-slate-600">
                    {[f.adresse, f.complement_adresse, [f.code_postal, f.commune].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(" — ")}
                  </p>
                )}
                {interlocuteurs.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun interlocuteur renseigné</p>
                ) : (
                  interlocuteurs.map((it, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-slate-800">{it.nom || "—"}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                        {it.portable && (
                          <a
                            href={`tel:${it.portable}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-brand-green-dark hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                            {it.portable}
                          </a>
                        )}
                        {it.tel && (
                          <a
                            href={`tel:${it.tel}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-brand-green-dark hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                            {it.tel}
                          </a>
                        )}
                        {it.email && (
                          <a
                            href={`mailto:${it.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-600 hover:underline"
                          >
                            {it.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const COLONNES_ADMIN: ColonneTableur[] = [
  { titre: "Nom", largeur: "22%" },
  { titre: "Nature fourniture", largeur: "20%" },
  { titre: "Ville", largeur: "16%" },
  { titre: "Localisation", largeur: "12%" },
  { titre: "Interlocuteurs", largeur: "30%" },
];

/// Vue admin : tableau classeur complet (même composant que Devis),
/// filtres au-dessus, clic sur une ligne → fiche détaillée.
function VueAdmin({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  return (
    <Tableur
      colonnes={COLONNES_ADMIN}
      lignes={fournisseurs.map((f) => {
        const noms = interlocuteursDe(f)
          .map((it) => it.nom)
          .filter(Boolean);
        return [
          <Link key="nom" href={`/repertoire/fournisseurs/${f.id}`} className="font-bold text-slate-900 hover:underline">
            {f.nom}
          </Link>,
          f.nature_fourniture,
          f.commune,
          f.localisation,
          noms.join(", "),
        ];
      })}
      vide="Aucun fournisseur trouvé"
    />
  );
}
