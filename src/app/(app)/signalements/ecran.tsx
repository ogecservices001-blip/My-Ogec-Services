"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Bug, Lightbulb, MessageSquare, Send, ChevronRight, Download } from "lucide-react";
import { envoyerSignalement } from "./actions";
import { Tableur } from "@/components/tableur";
import { construireModules } from "@/lib/menus";
import type { Signalement, TypeSignalement } from "@/lib/types";

const TYPES: { valeur: TypeSignalement; label: string; icone: typeof Bug; couleur: string }[] = [
  { valeur: "bug", label: "Bug", icone: Bug, couleur: "bg-red-100 text-red-600" },
  { valeur: "suggestion", label: "Suggestion", icone: Lightbulb, couleur: "bg-amber-100 text-amber-600" },
  { valeur: "remarque", label: "Remarque", icone: MessageSquare, couleur: "bg-sky-100 text-sky-600" },
];

const LABEL_TYPE: Record<TypeSignalement, string> = {
  bug: "Bug",
  suggestion: "Suggestion",
  remarque: "Remarque",
};

const NATURES: Record<TypeSignalement, string[]> = {
  bug: [
    "Rien ne se passe quand je clique",
    "Message d'erreur affiché",
    "Une info est fausse ou manquante",
    "L'appli est lente",
    "Autre",
  ],
  suggestion: ["Ajouter une information", "Simplifier cet écran", "Me faire gagner du temps", "Autre idée"],
  remarque: ["Remarque positive", "Ça me gêne", "Question", "Autre"],
};

type Option = { valeur: string; label: string; icone?: typeof Bug; couleur?: string };

/// Une étape du pas-à-pas : tant qu'elle n'est pas répondue, affiche
/// les choix ; une fois répondue, se réduit à une ligne de résumé avec
/// un lien "Changer" — évite d'empiler toutes les grilles de boutons
/// à l'écran en même temps.
function Etape({
  titre,
  valeurActuelle,
  options,
  onChoisir,
  onChanger,
}: {
  titre: string;
  valeurActuelle: string | null;
  options: Option[];
  onChoisir: (v: string) => void;
  onChanger: () => void;
}) {
  if (valeurActuelle !== null) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5">
        <p className="text-sm">
          <span className="text-slate-400">{titre} : </span>
          <span className="font-semibold text-slate-900">{valeurActuelle}</span>
        </p>
        <button
          onClick={onChanger}
          className="shrink-0 text-xs font-semibold text-brand-green-dark hover:underline"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 py-2.5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{titre}</p>
      <div className="space-y-2">
        {options.map(({ valeur, label, icone: Icone, couleur }) => (
          <button
            key={valeur}
            onClick={() => onChoisir(valeur)}
            className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"
          >
            {Icone && (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${couleur ?? "bg-violet-100 text-violet-600"}`}
              >
                <Icone className="h-4 w-4" strokeWidth={2} />
              </span>
            )}
            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function SignalementsEcran({
  isAdmin,
  signalements,
}: {
  isAdmin: boolean;
  signalements: Signalement[];
}) {
  const [type, setType] = useState<TypeSignalement | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [sousMenu, setSousMenu] = useState<string | null>(null);
  const [nature, setNature] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [envoi, startEnvoi] = useTransition();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // construireModules() renvoie des icônes (composants React) — à
  // calculer côté client uniquement, jamais reçu en prop d'un composant
  // serveur (une fonction ne peut pas traverser cette frontière RSC).
  const modules = useMemo(() => construireModules(isAdmin), [isAdmin]);
  const modulesActifs = modules.filter((m) => m.actif && m.sousMenus.length > 0);
  const moduleChoisi = modulesActifs.find((m) => m.nom === menu);

  function choisirType(t: string) {
    setType(t as TypeSignalement);
    setMenu(null);
    setSousMenu(null);
    setNature(null);
  }

  function choisirMenu(nom: string) {
    setMenu(nom);
    setSousMenu(null);
    setNature(null);
  }

  function envoyer() {
    setErreur(null);
    setConfirmation(null);
    startEnvoi(async () => {
      if (!type || !menu || !sousMenu || !nature) {
        setErreur("Merci de compléter les choix ci-dessus.");
        return;
      }
      const res = await envoyerSignalement({ type, menu, sousMenu, nature, detail });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setType(null);
      setMenu(null);
      setSousMenu(null);
      setNature(null);
      setDetail("");
      setConfirmation("Merci, c'est envoyé au bureau.");
    });
  }

  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Signalement retour terrain
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Un bug, une idée, une remarque sur l&apos;appli — dis-le nous.
      </p>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <Etape
          titre="Type"
          valeurActuelle={type ? LABEL_TYPE[type] : null}
          options={TYPES}
          onChoisir={choisirType}
          onChanger={() => {
            setType(null);
            setMenu(null);
            setSousMenu(null);
            setNature(null);
          }}
        />

        {type && (
          <Etape
            titre="Quel menu concerné ?"
            valeurActuelle={menu}
            options={modulesActifs.map((m) => ({ valeur: m.nom, label: m.nom, icone: m.icone, couleur: m.couleur }))}
            onChoisir={choisirMenu}
            onChanger={() => setMenu(null)}
          />
        )}

        {moduleChoisi && (
          <Etape
            titre="Quel écran précis ?"
            valeurActuelle={sousMenu}
            options={moduleChoisi.sousMenus.map((sm) => ({
              valeur: sm.nom,
              label: sm.nom,
              icone: moduleChoisi.icone,
              couleur: moduleChoisi.couleur,
            }))}
            onChoisir={(v) => {
              setSousMenu(v);
              setNature(null);
            }}
            onChanger={() => {
              setSousMenu(null);
              setNature(null);
            }}
          />
        )}

        {type && sousMenu && (
          <Etape
            titre="Quoi exactement ?"
            valeurActuelle={nature}
            options={NATURES[type].map((n) => ({
              valeur: n,
              label: n,
              icone: TYPES.find((t) => t.valeur === type)!.icone,
              couleur: TYPES.find((t) => t.valeur === type)!.couleur,
            }))}
            onChoisir={setNature}
            onChanger={() => setNature(null)}
          />
        )}

        {nature && (
          <div className="pt-3">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Précision (facultatif)
            </p>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Si besoin, quelques mots en plus..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />

            {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}

            <div className="mt-3 flex justify-end">
              <button
                onClick={envoyer}
                disabled={envoi}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
                {envoi ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        )}

        {confirmation && (
          <p className="pt-3 text-sm font-medium text-brand-green-dark">{confirmation}</p>
        )}
      </div>

      {isAdmin && <ListeAdmin signalements={signalements} />}
    </div>
  );
}

function ListeAdmin({ signalements }: { signalements: Signalement[] }) {
  const [filtre, setFiltre] = useState<"a_traiter" | "traites">("a_traiter");

  const aTraiter = signalements.filter((s) => !s.traite);
  const traites = signalements.filter((s) => s.traite);
  const affiches = filtre === "a_traiter" ? aTraiter : traites;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFiltre("a_traiter")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filtre === "a_traiter"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            À traiter ({aTraiter.length})
          </button>
          <button
            onClick={() => setFiltre("traites")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filtre === "traites"
                ? "bg-brand-green text-white shadow-sm"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            Traités ({traites.length})
          </button>
        </div>
        <Link
          href="/signalements/export"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          title="Exporter en Excel"
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
        </Link>
      </div>

      <Tableur
        colonnes={[
          { titre: "N°", largeur: "9%" },
          { titre: "Date", largeur: "10%" },
          { titre: "Type", largeur: "9%" },
          { titre: "Menu", largeur: "18%" },
          { titre: "Sous-menu", largeur: "18%" },
          { titre: "Nature", largeur: "22%" },
          { titre: "Auteur", largeur: "10%" },
          { titre: "Traité", largeur: "6%" },
        ]}
        lignes={affiches.map((s) => [
          <Link key="numero" href={`/signalements/${s.id}`} className="font-mono font-bold text-slate-900 hover:underline">
            {s.numero}
          </Link>,
          new Date(s.created_at).toLocaleDateString("fr-FR"),
          LABEL_TYPE[s.type],
          s.menu,
          s.sous_menu,
          s.nature,
          s.auteur_nom,
          s.traite ? "Oui" : "Non",
        ])}
        vide={filtre === "a_traiter" ? "Aucun signalement en attente" : "Aucun signalement traité"}
      />
    </div>
  );
}
