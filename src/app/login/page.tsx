"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function seConnecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setEnCours(false);
    if (error) {
      setErreur("Email ou mot de passe incorrect.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={seConnecter}
        className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col items-center">
          <Image
            src="/logo.jpg"
            alt="OGEC Services"
            width={96}
            height={92}
            className="mb-1 h-24 w-auto"
            priority
          />
        </div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        {erreur && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={enCours}
          className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {enCours ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
