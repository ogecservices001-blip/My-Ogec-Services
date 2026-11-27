"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { seDeconnecter } from "../actions";

export function BoutonDeconnexion() {
  const [enCours, start] = useTransition();
  return (
    <button
      disabled={enCours}
      onClick={() => start(() => seDeconnecter())}
      className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      Se déconnecter
    </button>
  );
}
