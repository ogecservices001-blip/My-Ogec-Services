"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { ChampEnTete, ChecklistItem, TypeValeurChecklist } from "@/lib/gmao/types";
import { enregistrerModeleBI } from "../actions";

function slugify(label: string, index: number): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `champ_${index}`;
}

type ChampEdit = { label: string; options: string; numerique: boolean; unite: string };
type ChecklistEdit = { label: string; typeValeur: TypeValeurChecklist; options: string };

export function ModeleBiEditor({
  pole,
  labelPole,
  champsInitiaux,
  checklistInitiale,
  texteTypeInitial,
}: {
  pole: string;
  labelPole: string;
  champsInitiaux: ChampEnTete[];
  checklistInitiale: ChecklistItem[];
  texteTypeInitial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [champs, setChamps] = useState<ChampEdit[]>(
    champsInitiaux.map((c) => ({ label: c.label, options: c.options.join(", "), numerique: c.numerique, unite: c.unite })),
  );
  const [checklist, setChecklist] = useState<ChecklistEdit[]>(
    checklistInitiale.map((c) => ({ label: c.label, typeValeur: c.typeValeur, options: c.options.join(", ") })),
  );
  const [texteType, setTexteType] = useState(texteTypeInitial);

  function enregistrer() {
    setErreur(null);
    const champsFinaux: ChampEnTete[] = champs
      .filter((c) => c.label.trim())
      .map((c, i) => ({
        cle: slugify(c.label, i),
        label: c.label.trim(),
        options: c.options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
        numerique: c.numerique,
        unite: c.unite.trim(),
        memeLigneSuivant: false,
      }));
    const checklistFinale: ChecklistItem[] = checklist
      .filter((c) => c.label.trim())
      .map((c, i) => ({
        rep: i + 1,
        label: c.label.trim(),
        typeValeur: c.typeValeur,
        options:
          c.typeValeur === "enum"
            ? c.options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : [],
      }));

    startTransition(async () => {
      const res = await enregistrerModeleBI(pole, { champs: champsFinaux, checklist: checklistFinale, texte_type: texteType.trim() });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push("/bi/referentiel");
      router.refresh();
    });
  }

  return (
    <div>
      <Link
        href="/bi/referentiel"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Pôle {pole} · {labelPole}
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        Modifier ce modèle n&apos;affecte aucun BI déjà créé — seul le prochain BI de ce pôle le reprend.
      </p>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Champs guidés du compte rendu</p>
        {champs.length === 0 && <p className="mb-2 text-sm text-slate-400">Aucun champ — le compte rendu reste en texte libre.</p>}
        <div className="space-y-3">
          {champs.map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3">
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={c.label}
                  onChange={(e) => setChamps((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Libellé du champ"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
                <button
                  onClick={() => setChamps((prev) => prev.filter((_, j) => j !== i))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={c.options}
                  onChange={(e) => setChamps((prev) => prev.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                  placeholder="Options séparées par virgule (vide = texte libre)"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-violet-600"
                />
                <input
                  value={c.unite}
                  onChange={(e) => setChamps((prev) => prev.map((x, j) => (j === i ? { ...x, unite: e.target.value } : x)))}
                  placeholder="Unité (optionnel)"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-violet-600"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setChamps((prev) => [...prev, { label: "", options: "", numerique: false, unite: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Ajouter un champ
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Checklist</p>
        {checklist.length === 0 && <p className="mb-2 text-sm text-slate-400">Aucune ligne de checklist pour ce pôle.</p>}
        <div className="space-y-3">
          {checklist.map((c, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-bold text-slate-400">{i + 1}.</span>
                <input
                  value={c.label}
                  onChange={(e) => setChecklist((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Libellé de l'opération"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
                <select
                  value={c.typeValeur}
                  onChange={(e) =>
                    setChecklist((prev) => prev.map((x, j) => (j === i ? { ...x, typeValeur: e.target.value as TypeValeurChecklist } : x)))
                  }
                  className="rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-violet-600"
                >
                  <option value="bool">Effectué</option>
                  <option value="enum">Choix</option>
                  <option value="text">Texte</option>
                </select>
                <button
                  onClick={() => setChecklist((prev) => prev.filter((_, j) => j !== i))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              {c.typeValeur === "enum" && (
                <input
                  value={c.options}
                  onChange={(e) => setChecklist((prev) => prev.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))}
                  placeholder="Options séparées par virgule"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-violet-600"
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setChecklist((prev) => [...prev, { label: "", typeValeur: "bool", options: "" }])}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Ajouter une ligne
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Texte-type (optionnel)</p>
        <textarea
          value={texteType}
          onChange={(e) => setTexteType(e.target.value)}
          rows={3}
          placeholder="Pré-remplit le compte rendu à la création d'un BI de ce pôle"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={enregistrer}
          disabled={pending}
          className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer le modèle"}
        </button>
      </div>
    </div>
  );
}
