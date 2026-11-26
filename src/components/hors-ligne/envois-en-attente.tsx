"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { EVENEMENT_CHANGEMENT, listerEnvois, supprimerEnvoi, majEnvoi, type Envoi } from "@/lib/hors-ligne/stockage";
import { surEnvoiReussi, traiterFile } from "@/lib/hors-ligne/file-envoi";
import "./traitements";

const INTERVALLE_MS = 20000;

/// Pastille de l'en-tête : envois faits sans réseau qui attendent (orange),
/// refusés par le serveur (rouge), ou « Envoyé ✓ » quelques secondes.
/// Relance la file au retour du réseau, à l'ouverture et toutes les 20 s.
export function EnvoisEnAttente() {
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [dernierEnvoye, setDernierEnvoye] = useState<string | null>(null);

  const rafraichir = useCallback(() => {
    listerEnvois().then(setEnvois);
  }, []);

  useEffect(() => {
    const relancer = () => {
      traiterFile().then(rafraichir);
    };
    const quandVisible = () => {
      if (document.visibilityState === "visible") relancer();
    };
    relancer();
    window.addEventListener("online", relancer);
    window.addEventListener(EVENEMENT_CHANGEMENT, rafraichir);
    document.addEventListener("visibilitychange", quandVisible);
    const minuteur = window.setInterval(relancer, INTERVALLE_MS);
    const desabonner = surEnvoiReussi((libelle) => {
      setDernierEnvoye(libelle);
      window.setTimeout(() => setDernierEnvoye(null), 6000);
    });
    return () => {
      window.removeEventListener("online", relancer);
      window.removeEventListener(EVENEMENT_CHANGEMENT, rafraichir);
      document.removeEventListener("visibilitychange", quandVisible);
      window.clearInterval(minuteur);
      desabonner();
    };
  }, [rafraichir]);

  const enErreur = envois.filter((e) => e.erreur);
  if (envois.length === 0 && !dernierEnvoye) return null;

  return (
    <div className="relative">
      {envois.length === 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Envoyé
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            enErreur.length > 0 ? "bg-red-500/25 text-red-200" : "bg-amber-500/25 text-amber-200"
          }`}
        >
          {enErreur.length > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
          {envois.length} en attente
        </button>
      )}
      {ouvert && envois.length > 0 && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-2xl bg-white p-3 text-slate-800 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">Envois en attente</p>
            <button type="button" onClick={() => setOuvert(false)} className="text-slate-400 hover:text-slate-700" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Enregistrés sur ce téléphone, sans réseau. Ils partent tout seuls dès que le réseau revient.
          </p>
          <ul className="space-y-2">
            {envois.map((e) => (
              <li key={e.id} className={`rounded-lg px-3 py-2 text-xs ${e.erreur ? "bg-red-50" : "bg-slate-50"}`}>
                <p className="font-semibold">{e.libelle}</p>
                <p className="text-slate-500">Enregistré le {new Date(e.creeLe).toLocaleString("fr-FR")}</p>
                {e.erreur && (
                  <>
                    <p className="mt-1 font-semibold text-red-700">Refusé : {e.erreur}</p>
                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await majEnvoi({ ...e, erreur: null });
                          await traiterFile(true);
                          rafraichir();
                        }}
                        className="rounded-lg bg-indigo-600 px-2 py-1 font-semibold text-white"
                      >
                        Réessayer
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Supprimer définitivement « ${e.libelle} » de ce téléphone ? La saisie sera perdue.`)) return;
                          await supprimerEnvoi(e.id);
                          rafraichir();
                        }}
                        className="rounded-lg border border-red-200 px-2 py-1 font-semibold text-red-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => traiterFile().then(rafraichir)}
            className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Envoyer maintenant
          </button>
        </div>
      )}
    </div>
  );
}
