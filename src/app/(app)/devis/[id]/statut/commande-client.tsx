"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import type { FichierCommandeClient } from "@/lib/devis/commande-client";
import {
  ajouterFichiersCommandeClient,
  supprimerFichierCommandeClient,
  urlFichierCommandeClient,
} from "../../commande-client-actions";

const ACCEPTE = "application/pdf,image/jpeg,image/png";

/// Choix de fichiers sans envoi : utilisé à "Marquer commandé", l'envoi se
/// fait au moment de valider la commande.
export function ChoixFichiersCommande({ onChange }: { onChange: (fichiers: File[]) => void }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-slate-600">Commande du client (PDF, photo ou scan)</label>
      <input
        type="file"
        multiple
        accept={ACCEPTE}
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
        className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
      />
    </div>
  );
}

export async function envoyerFichiersCommande(devisId: string, fichiers: File[]) {
  const formData = new FormData();
  for (const f of fichiers) formData.append("fichiers", f);
  return ajouterFichiersCommandeClient(devisId, formData);
}

export function BlocCommandeClient({ devisId, fichiers }: { devisId: string; fichiers: FichierCommandeClient[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  function joindre(liste: File[]) {
    if (liste.length === 0) return;
    setErreur(null);
    startTransition(async () => {
      const res = await envoyerFichiersCommande(devisId, liste);
      if (champ.current) champ.current.value = "";
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  function ouvrir(chemin: string) {
    const onglet = window.open("", "_blank");
    urlFichierCommandeClient(chemin).then((url) => {
      if (url && onglet) onglet.location.href = url;
      else {
        onglet?.close();
        setErreur("Impossible d'ouvrir le fichier.");
      }
    });
  }

  function supprimer(chemin: string) {
    setErreur(null);
    startTransition(async () => {
      const res = await supprimerFichierCommandeClient(devisId, chemin);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-slate-900">Commande client</h2>
      {fichiers.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Aucun fichier joint.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {fichiers.map((f) => (
            <li key={f.chemin} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <button type="button" onClick={() => ouvrir(f.chemin)} className="flex min-w-0 items-center gap-1.5 text-left font-medium text-slate-800 hover:underline">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                <span className="truncate">{f.nom}</span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-400">{f.ajoute_le}</span>
                <button type="button" onClick={() => supprimer(f.chemin)} disabled={pending} title="Supprimer" className="text-red-500 hover:text-red-700 disabled:opacity-40">
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        <Paperclip className="h-4 w-4" strokeWidth={2} />
        {pending ? "Envoi..." : "Joindre la commande du client"}
        <input ref={champ} type="file" multiple accept={ACCEPTE} className="hidden" disabled={pending} onChange={(e) => joindre(Array.from(e.target.files ?? []))} />
      </label>
      <p className="mt-2 text-xs text-slate-400">PDF, JPG ou PNG. Repris dans le PDF du devis une fois facturable.</p>
      {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
