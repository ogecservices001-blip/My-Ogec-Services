"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { demanderLienConnexion } from "./actions";

export function FormulaireConnexion() {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await demanderLienConnexion(email);
      setEnvoye(true);
    } catch {
      setErreur("Envoi impossible pour le moment. Merci de réessayer dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Accéder à votre espace</h1>
      {envoye ? (
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-[#3d7a32]">
            <MailCheck className="h-5 w-5" /> Vérifiez votre boîte mail
          </p>
          <p>
            Si votre adresse a accès à Mon contrat OGEC, un lien de connexion vient de vous être envoyé. Il est valable 30
            minutes.
          </p>
          <p className="text-slate-500">
            Rien reçu ? Vérifiez vos courriers indésirables, ou contactez-nous à ogec.services@orange.fr.
          </p>
        </div>
      ) : (
        <form onSubmit={envoyer} className="mt-4">
          <p className="mb-4 text-sm text-slate-600">
            Saisissez votre adresse email : nous vous envoyons un lien de connexion, sans mot de passe.
          </p>
          <label className="mb-1 block text-xs font-medium text-slate-600">Adresse email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#4f9a41] focus:ring-2 focus:ring-[#4f9a41]/20"
          />
          {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
          <button
            type="submit"
            disabled={envoi}
            className="mt-4 w-full rounded-xl bg-[#4f9a41] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3d7a32] disabled:opacity-60"
          >
            {envoi ? "Envoi..." : "Recevoir mon lien de connexion"}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            L&apos;accès est ouvert par OGEC Services aux contacts de votre contrat. Pour en bénéficier, contactez-nous.
          </p>
        </form>
      )}
    </div>
  );
}
