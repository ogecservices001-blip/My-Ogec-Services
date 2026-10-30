"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, MessageCircle, Mail, X, Wrench } from "lucide-react";
import type { Tables } from "@/lib/types";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FiltreSelect } from "@/components/filtre-select";
import { envoyerConfirmation } from "./actions";
import type { DevisEnCours } from "@/lib/devis/en-cours";
import { LABEL_STATUT_DEVIS } from "@/app/(app)/devis/statut";
import { telInternational } from "@/lib/format";

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

function formaterDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} ${deuxChiffres(d.getHours())}:${deuxChiffres(d.getMinutes())}`;
}

function formaterDelaiEntre(debut: string, fin: string | null): string {
  if (!fin) return "";
  const heures = (new Date(fin).getTime() - new Date(debut).getTime()) / 3_600_000;
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  if (heures < 24) return `${heures.toFixed(1)} h`;
  return `${Math.floor(heures / 24)} j ${Math.round(heures % 24)} h`;
}

function formaterDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/// Lien wa.me : numéro international sans "+" ni espaces.
function lienWhatsapp(portable: string, texte: string): string | null {
  const numero = telInternational(portable).replace(/[^\d]/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
}

type TechniciensParId = Record<string, { name: string; portable: string }>;
type ContactsParSite = Record<string, { nom: string; tel: string }>;

const COLONNES_EN_COURS: ColonneTableur[] = [
  { titre: "Statut" },
  { titre: "N°" },
  { titre: "Client — Site" },
  { titre: "Équipement" },
  { titre: "Motif" },
  { titre: "Devis en cours" },
  { titre: "Créé le" },
  { titre: "Intervenant" },
  { titre: "Date prévue" },
  { titre: "" },
];

const COLONNES_TRAITEES: ColonneTableur[] = [
  { titre: "N°" },
  { titre: "Client — Site" },
  { titre: "Équipement" },
  { titre: "Motif" },
  { titre: "Créé le" },
  { titre: "Traité le" },
  { titre: "Technicien" },
  { titre: "Délai", droite: true },
];

export function DepannagesListe({
  demandes,
  techniciensParId,
  contactsParSite = {},
  isAdmin,
  vue,
  devisEnCours,
}: {
  demandes: Tables<"demandes_depannage">[];
  techniciensParId: TechniciensParId;
  contactsParSite?: ContactsParSite;
  isAdmin: boolean;
  vue: "en_cours" | "traitees";
  devisEnCours: Record<string, DevisEnCours[]>;
}) {
  const enCours = demandes.filter((d) => d.statut !== "traitee");
  const traitees = demandes.filter((d) => d.statut === "traitee");
  const [client, setClient] = useState("");
  const clients = [...new Set(traitees.map((d) => d.client_nom).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filtrees = (vue === "en_cours" ? enCours : traitees).filter((d) => !client || d.client_nom === client);
  const [modaleId, setModaleId] = useState<string | null>(null);
  const demandeModale = demandes.find((d) => d.id === modaleId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {vue === "en_cours" ? "Dépannages en cours" : "Dépannages traités"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {vue === "traitees" && (
            <FiltreSelect
              valeur={client}
              onChange={setClient}
              toutes="Tous les clients"
              options={clients.map((c) => ({ valeur: c, label: c }))}
            />
          )}
          {isAdmin && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier, pas une page interne
            <a
              href="/depannages/export"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter en Excel (format Chrono Dépannage)"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
          )}
        </div>
      </div>

      {vue === "traitees" ? (
        <Tableur
          colonnes={COLONNES_TRAITEES}
          lignes={filtrees.map((d) => [
            <Link key="numero" href={`/depannages/${d.id}`} className="font-bold text-slate-900 hover:underline">
              {d.numero}
            </Link>,
            [d.client_nom, d.client_site].filter(Boolean).join(" — "),
            d.equipement_nom,
            d.message,
            formaterDateHeure(d.date_creation),
            d.date_traitement ? formaterDateHeure(d.date_traitement) : "",
            d.intervenant_id ? (techniciensParId[d.intervenant_id]?.name ?? "") : "",
            formaterDelaiEntre(d.date_creation, d.date_traitement),
          ])}
          valeurs={filtrees.map((d) => [d.numero])}
          vide="Aucun dépannage traité"
        />
      ) : (
        <Tableur
          colonnes={COLONNES_EN_COURS}
          lignes={filtrees.map((d) => {
            const intervenant = d.intervenant_id ? techniciensParId[d.intervenant_id] : undefined;
            const contact = d.site_id ? contactsParSite[d.site_id] : undefined;
            const devis = d.equipement_id ? (devisEnCours[d.equipement_id] ?? []) : [];
            const messageWhatsapp = `Dépannage N°${d.numero} — ${[d.client_nom, d.client_site].filter(Boolean).join(" — ")}\n${d.equipement_nom ? `Équipement : ${d.equipement_nom}\n` : ""}${d.lieu_panne ? `Lieu : ${d.lieu_panne}\n` : ""}${contact?.nom ? `Contact : ${contact.nom}\n` : ""}${contact?.tel ? `Tél : ${telInternational(contact.tel)}\n` : ""}Motif : ${d.message}`;
            const whatsapp = isAdmin && intervenant?.portable ? lienWhatsapp(intervenant.portable, messageWhatsapp) : null;
            return [
              <span key="statut" className={d.statut !== "traitee" ? "font-bold text-red-700" : ""}>
                Nouvelle
              </span>,
              <Link key="numero" href={`/depannages/${d.id}`} className="font-bold text-slate-900 hover:underline">
                {d.numero}
              </Link>,
              [d.client_nom, d.client_site].filter(Boolean).join(" — "),
              [d.equipement_nom, d.lieu_panne].filter(Boolean).join(" — "),
              d.message,
              devis.length > 0 ? devis.map((dv) => `${dv.numero} (${LABEL_STATUT_DEVIS[dv.statut]})`).join(", ") : "",
              formaterDateHeure(d.date_creation),
              intervenant?.name ?? "",
              d.date_intervention_prevue ? formaterDate(d.date_intervention_prevue) : "",
              <div key="actions" className="flex flex-wrap items-center justify-end gap-1.5">
                {isAdmin && d.email && (
                  <button
                    onClick={() => setModaleId(d.id)}
                    title="Répondre par email"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                  >
                    <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                )}
                {whatsapp && (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`WhatsApp ${intervenant?.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-green-200 text-green-700 transition hover:bg-green-50"
                  >
                    <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
                  </a>
                )}
                {d.statut !== "traitee" && !isAdmin && (
                  <Link
                    href={`/bi/nouveau?depannageId=${d.id}`}
                    title="Créer le BI"
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700"
                  >
                    <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                )}
              </div>,
            ];
          })}
          valeurs={filtrees.map((d) => [
            "Nouvelle",
            d.numero,
            [d.client_nom, d.client_site].filter(Boolean).join(" — "),
            [d.equipement_nom, d.lieu_panne].filter(Boolean).join(" — "),
            d.message,
            null,
            formaterDateHeure(d.date_creation),
            d.intervenant_id ? (techniciensParId[d.intervenant_id]?.name ?? "") : "",
          ])}
          vide="Aucun dépannage en cours"
        />
      )}

      {demandeModale && <ModaleConfirmation demande={demandeModale} onClose={() => setModaleId(null)} />}
    </div>
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
