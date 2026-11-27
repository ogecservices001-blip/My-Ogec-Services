"use client";

import { useChampManquant } from "@/components/champ-manquant";
import { useState } from "react";
import { CheckCircle2, FileText, Wrench } from "lucide-react";
import { soumettreDemandeDepannage } from "./actions";

export type IdentiteEquipement = {
  equipement: string;
  localisation: string;
  famille: string;
  client: string;
  site: string;
};

/// Page ouverte en scannant le QR d'un équipement. Seule l'identité de
/// l'équipement est visible ; la déclaration de panne reste immédiate
/// (adresse connue du site), la consultation passe par « Mon contrat OGEC »
/// (connexion par lien reçu par mail).
export function EquipementPublicClient({ codeQr, identite }: { codeQr: string; identite: IdentiteEquipement }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [demandeEnvoyee, setDemandeEnvoyee] = useState<{ numero: string; accuseEnvoye: boolean } | null>(null);
  const [panneOuverte, setPanneOuverte] = useState(false);
  const { signaler, fenetre } = useChampManquant();

  async function envoyerDemande() {
    setErreur(null);
    if (!email.trim() || !email.includes("@")) {
      signaler(email.trim() ? "Cette adresse email n'est pas valide" : "Saisissez votre adresse email", "public-email");
      return;
    }
    if (!message.trim()) {
      signaler("Décrivez la panne rencontrée", "public-message");
      return;
    }
    setEnvoiEnCours(true);
    try {
      const res = await soumettreDemandeDepannage(codeQr, email.trim(), message.trim());
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setDemandeEnvoyee({ numero: res.numero, accuseEnvoye: res.accuseEnvoye });
    } catch {
      setErreur("L'envoi a échoué, merci de réessayer dans un instant.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const champ =
    "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg space-y-3">
        {fenetre}
        <div className="rounded-2xl bg-teal-700 px-5 py-4 text-center text-white shadow-sm">
          <p className="text-sm font-bold">Équipement OGEC Services</p>
        </div>

        <div className="rounded-2xl bg-teal-50 p-4 shadow-sm">
          <p className="font-bold text-slate-900">{[identite.client, identite.site].filter(Boolean).join(" — ")}</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{identite.equipement}</p>
          {identite.famille && <p className="text-sm text-slate-600">{identite.famille}</p>}
          {identite.localisation && <p className="text-xs text-slate-500">{identite.localisation}</p>}
        </div>

        {demandeEnvoyee ? (
          <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 shadow-sm">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-green-dark" strokeWidth={2} />
            <div className="text-sm text-brand-green-dark">
              <p className="font-semibold">Votre demande de dépannage N°{demandeEnvoyee.numero} a bien été enregistrée.</p>
              <p className="mt-0.5">
                {demandeEnvoyee.accuseEnvoye
                  ? "Un accusé de réception vient de vous être envoyé par email. Nous revenons vers vous pour planifier l'intervention."
                  : "Nous revenons vers vous pour planifier l'intervention. Merci de noter ce numéro."}
              </p>
            </div>
          </div>
        ) : !panneOuverte ? (
          <button
            onClick={() => setPanneOuverte(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-red-800"
          >
            <Wrench className="h-5 w-5" strokeWidth={2} />
            Déclarer une panne
          </button>
        ) : (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-slate-900">Déclarer une panne</p>
            <label className="mb-1 block text-xs font-medium text-slate-600">Votre adresse email (connue d&apos;OGEC Services pour ce site)</label>
            <input id="public-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={champ} />
            <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Description de la panne</label>
            <textarea
              id="public-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Décrivez la panne rencontrée"
              className={champ}
            />
            {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
            <button
              onClick={envoyerDemande}
              disabled={envoiEnCours}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
            >
              <Wrench className="h-4 w-4" strokeWidth={2} />
              {envoiEnCours ? "Envoi..." : "Envoyer la demande"}
            </button>
            <p className="mt-2 text-xs text-slate-500">Un accusé de réception vous sera envoyé à cette adresse.</p>
          </div>
        )}

        <a
          href="/mon-contrat"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileText className="h-4 w-4 text-teal-700" strokeWidth={2} />
          Historique, rapports et prochains passages : Mon contrat OGEC
        </a>
      </div>
    </div>
  );
}
