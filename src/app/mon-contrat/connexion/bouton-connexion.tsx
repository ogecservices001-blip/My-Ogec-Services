"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { seConnecter } from "../actions";

export function BoutonConnexion({ jeton }: { jeton: string }) {
  const [enCours, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(jeton ? null : "Lien incomplet.");

  return (
    <div className="mt-5">
      {!erreur && (
        <button
          disabled={enCours}
          onClick={() =>
            start(async () => {
              const r = await seConnecter(jeton);
              if (r && !r.ok) setErreur(r.erreur);
            })
          }
          className="w-full rounded-xl bg-[#4f9a41] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3d7a32] disabled:opacity-60"
        >
          {enCours ? "Connexion..." : "Se connecter"}
        </button>
      )}
      {erreur && (
        <div className="space-y-3">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>
          <Link href="/mon-contrat" className="text-sm font-semibold text-[#3d7a32] hover:underline">
            Recevoir un nouveau lien
          </Link>
        </div>
      )}
    </div>
  );
}
