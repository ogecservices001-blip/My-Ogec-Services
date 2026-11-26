"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { changerMotDePasse } from "../actions";

type Etat = "verification" | "pret" | "invalide";

function Formulaire() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jeton = searchParams.get("token_hash");
  const [etat, setEtat] = useState<Etat>(jeton ? "verification" : "invalide");
  const verifieRef = useRef(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Le lien n'est consommé qu'ici, à l'ouverture de la page (pas par un
  // simple aperçu du mail).
  useEffect(() => {
    if (!jeton || verifieRef.current) return;
    verifieRef.current = true;
    createClient()
      .auth.verifyOtp({ type: "recovery", token_hash: jeton })
      .then(({ error }) => setEtat(error ? "invalide" : "pret"))
      .catch(() => setEtat("invalide"));
  }, [jeton]);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse.length < 6) return setErreur("Le mot de passe doit faire au moins 6 caractères.");
    if (motDePasse !== confirmation) return setErreur("Les deux mots de passe ne sont pas identiques.");
    setEnCours(true);
    try {
      const r = await changerMotDePasse(motDePasse);
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErreur("Enregistrement impossible pour l'instant (réseau ?). Réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  const champ =
    "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center">
        <Image src="/logo.jpg" alt="OGEC Services" width={96} height={92} className="mb-1 h-24 w-auto" priority />
        <p className="mt-2 text-base font-bold text-slate-900">Nouveau mot de passe</p>
      </div>

      {etat === "verification" && <p className="text-center text-sm text-slate-500">Vérification du lien...</p>}

      {etat === "invalide" && (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">Ce lien a expiré ou a déjà servi.</p>
          <Link href="/login/oubli" className="block text-center font-semibold text-brand-green-dark hover:underline">
            Refaire une demande
          </Link>
        </div>
      )}

      {etat === "pret" && (
        <form onSubmit={valider}>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Nouveau mot de passe</label>
          <input
            type={voir ? "text" : "password"}
            required
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className={`mb-4 ${champ}`}
          />
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirme-le</label>
          <input
            type={voir ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={`mb-2 ${champ}`}
          />
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={voir} onChange={(e) => setVoir(e.target.checked)} className="h-4 w-4 accent-brand-green" />
            Afficher le mot de passe
          </label>
          {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {enCours ? "Enregistrement..." : "Enregistrer et me connecter"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function NouveauMotDePassePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Suspense>
        <Formulaire />
      </Suspense>
    </div>
  );
}
