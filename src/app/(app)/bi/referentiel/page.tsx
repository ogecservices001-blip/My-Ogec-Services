import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ORDRE_AFFICHAGE_POLES, labelPole } from "@/lib/bi/constants";
import type { ChampEnTete, ChecklistItem } from "@/lib/gmao/types";

/// Tri numérique des codes de pôle (10, 15, 20...) — contrairement à
/// ORDRE_AFFICHAGE_POLES (fréquence d'usage côté assistant technicien),
/// ici c'est un référentiel consulté par le bureau : l'ordre numérique
/// est plus lisible pour parcourir/retrouver un pôle.
const POLES_TRIES = [...ORDRE_AFFICHAGE_POLES].sort((a, b) => Number(a) - Number(b));

export default async function ReferentielBiPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("bi_modeles").select("pole, champs, checklist");

  const modeleParPole = new Map(
    (data ?? []).map((m) => [
      m.pole,
      { nbChamps: (m.champs as ChampEnTete[]).length, nbChecklist: (m.checklist as ChecklistItem[]).length },
    ]),
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Référentiel BI</h1>
      <p className="mb-5 text-sm text-slate-500">
        Modèles par pôle (champs guidés + checklist) — consultés en direct par l&apos;assistant technicien.
      </p>

      <ul className="space-y-3">
        {POLES_TRIES.map((pole) => {
          const modele = modeleParPole.get(pole);
          return (
            <li key={pole}>
              <Link
                href={`/bi/referentiel/${pole}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                  <ClipboardList className="h-5 w-5 text-violet-600" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    Pôle {pole} · {labelPole(pole)}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {modele
                      ? `${modele.nbChamps} champ(s) · ${modele.nbChecklist} ligne(s) de checklist`
                      : "Aucun modèle défini — texte libre"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
