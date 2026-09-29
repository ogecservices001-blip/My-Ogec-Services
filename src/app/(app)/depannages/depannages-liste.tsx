"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, MessageCircle, User, CalendarClock } from "lucide-react";
import type { Tables } from "@/lib/types";
import { marquerTraitee } from "./actions";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

function formaterDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/// Lien wa.me : numéro international sans "+" ni espaces.
function lienWhatsapp(portable: string, texte: string): string | null {
  const numero = portable.replace(/[^\d]/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}

type TechniciensParId = Record<string, { name: string; portable: string }>;

type Onglet = "en_cours" | "traitees";

export function DepannagesListe({
  demandes,
  techniciensParId,
}: {
  demandes: Tables<"demandes_depannage">[];
  techniciensParId: TechniciensParId;
}) {
  const [onglet, setOnglet] = useState<Onglet>("en_cours");

  const enCours = demandes.filter((d) => d.statut !== "traitee");
  const traitees = demandes.filter((d) => d.statut === "traitee");
  const filtrees = onglet === "en_cours" ? enCours : traitees;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Suivi Dépannage</h1>
          <p className="text-sm text-slate-500">
            Demandes reçues via QR équipement ou créées par le bureau
          </p>
        </div>
        <Link
          href="/depannages/nouveau"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Nouveau dépannage
        </Link>
      </div>

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
            <CarteDemande
              key={d.id}
              demande={d}
              intervenant={d.intervenant_id ? techniciensParId[d.intervenant_id] : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteDemande({
  demande,
  intervenant,
}: {
  demande: Tables<"demandes_depannage">;
  intervenant: { name: string; portable: string } | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nouvelle = demande.statut !== "traitee";

  const messageWhatsapp = `Dépannage n°${demande.numero} — ${[demande.client_nom, demande.client_site].filter(Boolean).join(" — ")}\n${demande.equipement_nom ? `Équipement : ${demande.equipement_nom}\n` : ""}${demande.lieu_panne ? `Lieu : ${demande.lieu_panne}\n` : ""}Motif : ${demande.message}`;
  const whatsapp = intervenant?.portable ? lienWhatsapp(intervenant.portable, messageWhatsapp) : null;

  return (
    <li
      className={`rounded-2xl bg-white p-4 shadow-sm ${nouvelle ? "border border-red-200 bg-red-50/40" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="font-bold text-slate-900">
          n°{demande.numero} — {[demande.client_nom, demande.client_site].filter(Boolean).join(" — ")}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            nouvelle ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
          }`}
        >
          {nouvelle ? "Nouvelle" : "Traitée"}
        </span>
      </div>
      {demande.equipement_nom && (
        <p className="text-sm font-semibold text-slate-800">{demande.equipement_nom}</p>
      )}
      {demande.lieu_panne && <p className="text-xs text-slate-500">Lieu : {demande.lieu_panne}</p>}
      <p className="mt-1.5 text-sm text-slate-700">{demande.message}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {demande.email ? `Demandé par ${demande.email}` : "Créé par le bureau"} —{" "}
          {formaterDateHeure(demande.date_creation)}
        </span>
        {demande.numero_demande_client && <span>Réf. client : {demande.numero_demande_client}</span>}
      </div>

      {(intervenant || demande.date_intervention_prevue) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-teal-700">
          {intervenant && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" strokeWidth={2} />
              {intervenant.name}
            </span>
          )}
          {demande.date_intervention_prevue && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
              {formaterDate(demande.date_intervention_prevue)}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50"
          >
            <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
            WhatsApp {intervenant?.name}
          </a>
        )}
        {nouvelle && (
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
        )}
      </div>
    </li>
  );
}
