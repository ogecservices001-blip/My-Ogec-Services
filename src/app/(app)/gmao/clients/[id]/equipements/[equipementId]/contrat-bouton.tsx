"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSignature } from "lucide-react";
import { useChampManquant } from "@/components/champ-manquant";
import { changerContratEquipement } from "../actions";

/// Bureau : passer l'équipement sous contrat une fois l'avenant signé, ou le
/// repasser hors contrat.
export function ContratBouton({ id, siteId, horsContrat }: { id: string; siteId: string; horsContrat: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dateAvenant, setDateAvenant] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const { signaler, fenetre } = useChampManquant();

  function changer(sousContrat: boolean) {
    setErreur(null);
    if (sousContrat && !dateAvenant) {
      signaler("Indique la date de l'avenant", "contrat-date-avenant");
      return;
    }
    startTransition(async () => {
      const res = await changerContratEquipement(id, siteId, sousContrat, dateAvenant);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  if (!horsContrat) {
    return (
      <button
        type="button"
        onClick={() => changer(false)}
        disabled={pending}
        className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-orange-700 hover:underline disabled:opacity-60"
      >
        {pending ? "..." : "Repasser hors contrat"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fenetre}
      <label className="text-xs font-medium text-orange-800" htmlFor="contrat-date-avenant">
        Avenant du
      </label>
      <input
        id="contrat-date-avenant"
        type="date"
        value={dateAvenant}
        onChange={(e) => setDateAvenant(e.target.value)}
        className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-sm outline-none focus:border-orange-400"
      />
      <button
        type="button"
        onClick={() => changer(true)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
      >
        <FileSignature className="h-4 w-4" strokeWidth={2.25} />
        {pending ? "..." : "Passer sous contrat"}
      </button>
      {erreur && <span className="text-xs text-red-600">{erreur}</span>}
    </div>
  );
}
