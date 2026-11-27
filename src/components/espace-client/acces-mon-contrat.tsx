"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { activerAccesClient, couperAccesClient } from "@/app/(app)/repertoire/clients/[id]/acces-client-actions";

export type LigneAccesContact = {
  email: string;
  nom: string;
  role: string;
  actif: boolean;
  inviteLe: string | null;
  derniereConnexion: string | null;
};

const quand = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" }) : "";

/// Fiche site (bureau) : ouverture de « Mon contrat OGEC », contact par contact.
export function AccesMonContrat({ siteId, contacts }: { siteId: string; contacts: LigneAccesContact[] }) {
  const router = useRouter();
  const [enCours, start] = useTransition();
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);

  function agir(action: () => Promise<{ ok: true } | { ok: false; erreur: string }>, succes: string) {
    setMessage(null);
    start(async () => {
      const r = await action();
      setMessage(r.ok ? { texte: succes, erreur: false } : { texte: r.erreur, erreur: true });
      router.refresh();
    });
  }

  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <KeyRound className="h-4 w-4 text-brand-green" /> Mon contrat OGEC — accès client
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Le contact activé reçoit une invitation par mail et accède ensuite à son espace (prochains passages, visites et
        rapports) par un lien de connexion, sans mot de passe.
      </p>
      {contacts.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune adresse email sur cette fiche.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {contacts.map((c) => (
            <div key={c.email} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {c.nom || c.email} <span className="font-normal text-slate-400">· {c.role}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {c.email}
                  {c.actif &&
                    ` · invité le ${quand(c.inviteLe)}${c.derniereConnexion ? ` · dernière connexion le ${quand(c.derniereConnexion)}` : " · jamais connecté"}`}
                </p>
              </div>
              {c.actif ? (
                <div className="flex gap-2">
                  <span className="self-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-brand-green-dark">Actif</span>
                  <button
                    disabled={enCours}
                    onClick={() => agir(() => activerAccesClient(siteId, c.email), `Invitation renvoyée à ${c.email}.`)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Renvoyer l&apos;invitation
                  </button>
                  <button
                    disabled={enCours}
                    onClick={() => {
                      if (confirm(`Couper l'accès de ${c.email} à ce site ?`)) agir(() => couperAccesClient(siteId, c.email), `Accès coupé pour ${c.email}.`);
                    }}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Couper
                  </button>
                </div>
              ) : (
                <button
                  disabled={enCours}
                  onClick={() => agir(() => activerAccesClient(siteId, c.email), `Accès activé, invitation envoyée à ${c.email}.`)}
                  className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
                >
                  Activer et inviter
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {message && <p className={`mt-2 text-sm ${message.erreur ? "text-red-600" : "text-brand-green-dark"}`}>{message.texte}</p>}
    </div>
  );
}
