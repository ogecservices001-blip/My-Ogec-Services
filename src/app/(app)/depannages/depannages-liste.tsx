"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Download, MessageCircle, Mail, User, CalendarClock, X } from "lucide-react";
import type { Tables } from "@/lib/types";
import { marquerTraitee, envoyerConfirmation } from "./actions";
import { StatistiquesTab } from "./statistiques";

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

type Onglet = "en_cours" | "traitees" | "statistiques";

export function DepannagesListe({
  demandes,
  techniciensParId,
  isAdmin,
}: {
  demandes: Tables<"demandes_depannage">[];
  techniciensParId: TechniciensParId;
  isAdmin: boolean;
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <a
              href="/depannages/export"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter en Excel (format Chrono Dépannage)"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
          )}
          <Link
            href="/depannages/nouveau"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nouveau dépannage
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-2">
        <button
          onClick={() => setOnglet("en_cours")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "en_cours"
              ? "bg-red-600 text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Dépannages en cours ({enCours.length})
        </button>
        <button
          onClick={() => setOnglet("traitees")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "traitees"
              ? "bg-brand-green text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Dépannages traitées ({traitees.length})
        </button>
        <button
          onClick={() => setOnglet("statistiques")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            onglet === "statistiques"
              ? "bg-slate-800 text-white shadow-sm"
              : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Statistiques
        </button>
      </div>

      {onglet === "statistiques" ? (
        <StatistiquesTab demandes={demandes} techniciensParId={techniciensParId} />
      ) : filtrees.length === 0 ? (
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
  const [modaleOuverte, setModaleOuverte] = useState(false);
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
        {demande.email && (
          <button
            onClick={() => setModaleOuverte(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2} />
            Répondre par email
          </button>
        )}
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

      {modaleOuverte && (
        <ModaleConfirmation demande={demande} onClose={() => setModaleOuverte(false)} />
      )}
    </li>
  );
}

function ModaleConfirmation({
  demande,
  onClose,
}: {
  demande: Tables<"demandes_depannage">;
  onClose: () => void;
}) {
  const router = useRouter();
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Répondre à {demande.email}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Envoie un email récapitulatif (client, site, motif, intervenant assigné, date prévue...) — ajoute
          une information complémentaire si besoin.
        </p>
        <textarea
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          rows={3}
          placeholder="Information complémentaire (optionnel)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await envoyerConfirmation(demande.id, info);
                if (!res.ok) {
                  setErreur(res.erreur);
                  return;
                }
                onClose();
                router.refresh();
              })
            }
            disabled={pending}
            className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-60"
          >
            {pending ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
