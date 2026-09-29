"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { Tables } from "@/lib/types";
import { marquerTraitee } from "./actions";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

type Onglet = "en_cours" | "traitees";

export function DepannagesListe({ demandes }: { demandes: Tables<"demandes_depannage">[] }) {
  const [onglet, setOnglet] = useState<Onglet>("en_cours");

  const enCours = demandes.filter((d) => d.statut !== "traitee");
  const traitees = demandes.filter((d) => d.statut === "traitee");
  const filtrees = onglet === "en_cours" ? enCours : traitees;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Suivi Dépannage</h1>
      <p className="mb-5 text-sm text-slate-500">
        Demandes reçues depuis les pages publiques équipement (QR code scanné)
      </p>

      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setOnglet("en_cours")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "en_cours"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Dépannages en cours ({enCours.length})
        </button>
        <button
          onClick={() => setOnglet("traitees")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "traitees"
              ? "bg-brand-green text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Dépannages traitées ({traitees.length})
        </button>
      </div>

      {filtrees.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {onglet === "en_cours" ? "Aucun dépannage en cours" : "Aucun dépannage traité"}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtrees.map((d) => (
            <CarteDemande key={d.id} demande={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteDemande({ demande }: { demande: Tables<"demandes_depannage"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nouvelle = demande.statut !== "traitee";

  return (
    <li
      className={`rounded-2xl bg-white p-4 shadow-sm ${nouvelle ? "border border-red-200 bg-red-50/40" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-bold text-slate-900">
          {[demande.client_nom, demande.client_site].filter(Boolean).join(" — ")}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            nouvelle ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
          }`}
        >
          {nouvelle ? "Nouvelle" : "Traitée"}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-800">{demande.equipement_nom}</p>
      <p className="mt-1.5 text-sm text-slate-700">{demande.message}</p>
      <p className="mt-2 text-xs text-slate-500">
        Demandé par {demande.email} — {formaterDateHeure(demande.date_creation)}
      </p>
      {nouvelle && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() =>
              startTransition(async () => {
                await marquerTraitee(demande.id);
                router.refresh();
              })
            }
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            {pending ? "..." : "Marquer comme traitée"}
          </button>
        </div>
      )}
    </li>
  );
}
