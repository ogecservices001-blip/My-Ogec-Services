"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { demanderReinitialisation } from "../actions";

function Formulaire() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await demanderReinitialisation(email);
      setEnvoye(true);
    } catch {
      setErreur("Envoi impossible pour l'instant (réseau ?). Réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <Image src="/logo.jpg" alt="OGEC Services" width={96} height={92} className="mb-1 h-24 w-auto" priority />
        <p className="mt-2 text-base font-bold text-slate-900">Mot de passe oublié</p>
      </div>
      {envoye ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="flex items-center gap-2 font-semibold text-brand-green-dark">
            <MailCheck className="h-5 w-5" /> Demande envoyée
          </p>
          <p>
            Si cette adresse correspond à un compte technicien, un mail vient de partir avec un lien pour choisir un
            nouveau mot de passe. Il est valable une heure.
          </p>
          <p className="text-slate-500">Rien reçu après quelques minutes ? Regarde dans les courriers indésirables, ou appelle le bureau.</p>
        </div>
      ) : (
        <form onSubmit={envoyer}>
          <p className="mb-4 text-sm text-slate-600">
            Indique l&apos;adresse mail avec laquelle tu te connectes : tu vas recevoir un lien pour choisir un nouveau mot
            de passe.
          </p>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
          />
          {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {enCours ? "Envoi..." : "Recevoir le lien"}
          </button>
          <p className="mt-3 text-xs text-slate-500">Réservé aux techniciens. Pour les autres comptes, contacte le bureau.</p>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-brand-green-dark hover:underline">
        Retour à la connexion
      </Link>
    </div>
  );
}

export default function MotDePasseOubliePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Suspense>
        <Formulaire />
      </Suspense>
    </div>
  );
}
