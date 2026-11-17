"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { affichageDonneePU, CHAMPS_TEXTE, dateFrPU, formatNombrePU, type ArticlePU } from "@/lib/devis/referentiel-pu";
import { supprimerArticlePU, supprimerArticlesPU } from "./actions";
import { FormulaireArticlePU } from "./formulaire-article";
import { ModaleImportPU } from "./modale-import";

const COLONNES: ColonneTableur[] = [
  { titre: "", largeur: "36px" },
  { titre: "Famille" },
  { titre: "Type" },
  { titre: "Donnée 1" },
  { titre: "Donnée 2", largeur: "70px" },
  { titre: "Donnée 3", largeur: "80px" },
  { titre: "Donnée 4", largeur: "80px" },
  { titre: "Donnée 5" },
  { titre: "Donnée 6" },
  { titre: "Tarif net HT", droite: true, largeur: "100px" },
  { titre: "MO", droite: true, largeur: "60px" },
  { titre: "Date tarif", largeur: "95px" },
  { titre: "" },
];

export function ReferentielPUListe({ articles }: { articles: ArticlePU[] }) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState<{ existant: ArticlePU | null } | null>(null);
  const [modaleImport, setModaleImport] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [suppression, startSuppression] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const filtres = useMemo(() => {
    const mots = recherche.toLowerCase().split(/\s+/).filter(Boolean);
    if (mots.length === 0) return articles;
    return articles.filter((a) => {
      const texte = CHAMPS_TEXTE.map((c) => a[c]).join(" ").toLowerCase();
      return mots.every((m) => texte.includes(m));
    });
  }, [articles, recherche]);

  const selectionValide = useMemo(() => {
    const ids = new Set(articles.map((a) => a.id));
    return [...selection].filter((id) => ids.has(id));
  }, [articles, selection]);

  const tousFiltresCoches = filtres.length > 0 && filtres.every((a) => selection.has(a.id));

  function basculer(id: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function basculerTous() {
    setSelection((s) => {
      const n = new Set(s);
      if (tousFiltresCoches) filtres.forEach((a) => n.delete(a.id));
      else filtres.forEach((a) => n.add(a.id));
      return n;
    });
  }

  function supprimerSelection() {
    setErreur(null);
    startSuppression(async () => {
      const res = await supprimerArticlesPU(selectionValide);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setSelection(new Set());
      setConfirmerSuppression(false);
      router.refresh();
    });
  }

  const bouton =
    "inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Référentiel PU</h1>
          <p className="text-sm text-slate-500">
            {filtres.length} article(s){filtres.length !== articles.length ? ` sur ${articles.length}` : ""} — Donnée 2 = unité
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Rechercher un article..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-60 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <a href="/devis/referentiel-pu/export" className={bouton} title="Exporter en Excel">
            <Download className="h-4 w-4" strokeWidth={2.25} />
            Exporter
          </a>
          <button onClick={() => setModaleImport(true)} className={bouton} title="Importer un classeur">
            <Upload className="h-4 w-4" strokeWidth={2.25} />
            Importer
          </button>
          <button
            onClick={() => setFormulaire({ existant: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Ajouter
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={tousFiltresCoches} onChange={basculerTous} className="h-4 w-4 accent-brand-green" />
          {recherche ? "Cocher les articles trouvés" : "Tout cocher"}
        </label>
        {selectionValide.length > 0 && !confirmerSuppression && (
          <button
            onClick={() => setConfirmerSuppression(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            Supprimer la sélection ({selectionValide.length})
          </button>
        )}
        {confirmerSuppression && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm text-red-700">
              Supprimer définitivement {selectionValide.length} article(s) ?
            </span>
            <button
              onClick={supprimerSelection}
              disabled={suppression}
              className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {suppression ? "Suppression..." : "Oui, supprimer"}
            </button>
            <button
              onClick={() => setConfirmerSuppression(false)}
              disabled={suppression}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        )}
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      </div>

      <Tableur
        colonnes={COLONNES}
        largeurMin={1100}
        lignes={filtres.map((a) => [
          <input
            key="coche"
            type="checkbox"
            checked={selection.has(a.id)}
            onChange={() => basculer(a.id)}
            className="h-4 w-4 accent-brand-green"
            aria-label="Sélectionner"
          />,
          a.famille,
          <button
            key="type"
            type="button"
            onClick={() => setFormulaire({ existant: a })}
            className="text-left font-semibold text-slate-900 hover:underline"
          >
            {a.type}
          </button>,
          a.donnee1,
          a.donnee2,
          affichageDonneePU(a.donnee3),
          a.donnee4,
          a.donnee5,
          a.donnee6,
          a.tarif_net_ht === null ? "" : `${formatNombrePU(a.tarif_net_ht)} €`,
          formatNombrePU(a.mo_heures),
          dateFrPU(a.date_maj_tarif),
          <div key="actions" className="flex items-center gap-1">
            <button
              onClick={() => setFormulaire({ existant: a })}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <BoutonSupprimer
              action={supprimerArticlePU.bind(null, a.id)}
              confirmation={`Supprimer « ${a.type} ${a.donnee5} » ?`}
              redirectTo="/devis/referentiel-pu"
            />
          </div>,
        ])}
        valeurs={filtres.map((a) => [null, a.famille, a.type, null, null, null, null, null, null, a.tarif_net_ht, a.mo_heures, dateFrPU(a.date_maj_tarif)])}
        vide="Référentiel vide — importe ton classeur Réferentiel PU.xlsx ou ajoute un article"
      />

      {formulaire && (
        <FormulaireArticlePU
          key={formulaire.existant?.id ?? "nouveau"}
          existant={formulaire.existant}
          onClose={() => setFormulaire(null)}
        />
      )}
      {modaleImport && <ModaleImportPU onClose={() => setModaleImport(false)} />}
    </div>
  );
}
