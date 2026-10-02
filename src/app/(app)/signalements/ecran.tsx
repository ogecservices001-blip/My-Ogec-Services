"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bug, Lightbulb, MessageSquare, Send, ChevronRight } from "lucide-react";
import { envoyerSignalement } from "./actions";
import { TypeBadge } from "@/components/signalements/type-badge";
import type { Module } from "@/lib/menus";
import type { Signalement, TypeSignalement } from "@/lib/types";

const TYPES: { valeur: TypeSignalement; label: string; icone: typeof Bug }[] = [
  { valeur: "bug", label: "Bug", icone: Bug },
  { valeur: "suggestion", label: "Suggestion", icone: Lightbulb },
  { valeur: "remarque", label: "Remarque", icone: MessageSquare },
];

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

function BoutonChoix({
  label,
  actif,
  onClick,
}: {
  label: string;
  actif: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
        actif ? "bg-brand-green text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

export function SignalementsEcran({
  isAdmin,
  modules,
  signalements,
}: {
  isAdmin: boolean;
  modules: Module[];
  signalements: Signalement[];
}) {
  const [type, setType] = useState<TypeSignalement>("bug");
  const [menu, setMenu] = useState<string | null>(null);
  const [sousMenu, setSousMenu] = useState<string | null>(null);
  const [nature, setNature] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [envoi, startEnvoi] = useTransition();
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const modulesActifs = modules.filter((m) => m.actif && m.sousMenus.length > 0);
  const moduleChoisi = modulesActifs.find((m) => m.nom === menu);

  function choisirType(t: TypeSignalement) {
    setType(t);
    setNature(null);
  }

  function choisirMenu(nom: string) {
    setMenu(nom);
    setSousMenu(null);
  }

  function envoyer() {
    setErreur(null);
    setConfirmation(null);
    startEnvoi(async () => {
      if (!menu || !sousMenu || !nature) {
        setErreur("Merci de compléter les 3 choix ci-dessus.");
        return;
      }
      const res = await envoyerSignalement({ type, menu, sousMenu, nature, detail });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setMenu(null);
      setSousMenu(null);
      setNature(null);
      setDetail("");
      setConfirmation("Merci, c'est envoyé au bureau.");
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Signalement retour terrain
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Un bug, une idée, une remarque sur l&apos;appli — dis-le nous.
      </p>

      <div className="mb-6 space-y-4 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Type</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(({ valeur, label, icone: Icone }) => (
              <button
                key={valeur}
                onClick={() => choisirType(valeur)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  type === valeur
                    ? "bg-brand-green text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Icone className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Quel menu concerné ?
          </p>
          <div className="flex flex-wrap gap-2">
            {modulesActifs.map((m) => (
              <BoutonChoix key={m.nom} label={m.nom} actif={menu === m.nom} onClick={() => choisirMenu(m.nom)} />
            ))}
          </div>
        </div>

        {moduleChoisi && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Quel écran précis ?
            </p>
            <div className="flex flex-wrap gap-2">
              {moduleChoisi.sousMenus.map((sm) => (
                <BoutonChoix
                  key={sm.nom}
                  label={sm.nom}
                  actif={sousMenu === sm.nom}
                  onClick={() => setSousMenu(sm.nom)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Quoi exactement ?
          </p>
          <div className="flex flex-wrap gap-2">
            {NATURES[type].map((n) => (
              <BoutonChoix key={n} label={n} actif={nature === n} onClick={() => setNature(n)} />
            ))}
          </div>
        </div>

        <div>
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
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {confirmation && <p className="text-sm font-medium text-brand-green-dark">{confirmation}</p>}

        <div className="flex justify-end">
          <button
            onClick={envoyer}
            disabled={envoi || !menu || !sousMenu || !nature}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            {envoi ? "Envoi..." : "Envoyer"}
          </button>
        </div>
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
      <div className="mb-4 flex gap-2">
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

      {affiches.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {filtre === "a_traiter" ? "Aucun signalement en attente" : "Aucun signalement traité"}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {affiches.map((s) => (
            <li key={s.id}>
              <Link
                href={`/signalements/${s.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-sm font-bold text-slate-900">{s.numero}</p>
                    <TypeBadge type={s.type} />
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {s.menu} — {s.sous_menu}
                  </p>
                  <p className="truncate text-xs text-slate-400">{s.nature}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
