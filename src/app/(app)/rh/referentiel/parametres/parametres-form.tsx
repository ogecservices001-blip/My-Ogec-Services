"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useChampManquant } from "@/components/champ-manquant";
import { enregistrerParametresPaie, type ParametresPaie } from "../actions";

const GROUPES: { titre: string; champs: { cle: keyof ParametresPaie; libelle: string; unite: string }[] }[] = [
  {
    titre: "Heures supplémentaires (par semaine)",
    champs: [
      { cle: "duree_legale_hebdo", libelle: "Durée légale — au-delà : heures supplémentaires", unite: "h" },
      { cle: "plafond_hs25_hebdo", libelle: "Heures à 25 % jusqu'à — au-delà : 50 %", unite: "h" },
    ],
  },
  {
    titre: "Panier repas",
    champs: [
      { cle: "panier_montant", libelle: "Montant d'un panier", unite: "€" },
      { cle: "panier_seuil_heures", libelle: "Attribué si la journée dépasse", unite: "h" },
    ],
  },
  {
    titre: "Horaires journaliers attendus",
    champs: [
      { cle: "horaire_lundi", libelle: "Lundi", unite: "h" },
      { cle: "horaire_mardi", libelle: "Mardi", unite: "h" },
      { cle: "horaire_mercredi", libelle: "Mercredi", unite: "h" },
      { cle: "horaire_jeudi", libelle: "Jeudi", unite: "h" },
      { cle: "horaire_vendredi", libelle: "Vendredi", unite: "h" },
    ],
  },
];

export function ParametresForm({ valeurs }: { valeurs: ParametresPaie }) {
  const router = useRouter();
  const [saisie, setSaisie] = useState<Record<keyof ParametresPaie, string>>(
    () => Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, String(v)])) as Record<keyof ParametresPaie, string>,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { signaler, fenetre } = useChampManquant();

  function enregistrer() {
    setMessage(null);
    const vide = GROUPES.flatMap((g) => g.champs).find((c) => !String(saisie[c.cle] ?? "").trim());
    if (vide) return signaler(`Renseigne : ${vide.libelle}`, `param-${vide.cle}`);
    startTransition(async () => {
      const valeursEnvoyees = Object.fromEntries(GROUPES.flatMap((g) => g.champs).map((c) => [c.cle, saisie[c.cle]])) as Record<keyof ParametresPaie, string>;
      const res = await enregistrerParametresPaie(valeursEnvoyees);
      if (!res.ok) {
        const cle = Object.keys(res.champs ?? {})[0];
        return signaler(res.erreur, cle ? `param-${cle}` : null);
      }
      setMessage("Paramètres enregistrés.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {fenetre}
      <div className="grid gap-4 lg:grid-cols-3">
        {GROUPES.map((g) => (
          <div key={g.titre} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-slate-900">{g.titre}</p>
            <div className="space-y-3">
              {g.champs.map((c) => (
                <label key={c.cle} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span>{c.libelle}</span>
                  <span className="flex items-center gap-1">
                    <input
                      id={`param-${c.cle}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={saisie[c.cle] ?? ""}
                      onChange={(e) => setSaisie((s) => ({ ...s, [c.cle]: e.target.value }))}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right"
                    />
                    <span className="w-4 text-slate-400">{c.unite}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-sm font-semibold text-brand-green-dark">{message}</span>}
        <button onClick={enregistrer} disabled={pending} className="rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60">
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
