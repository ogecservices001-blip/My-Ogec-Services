"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Send } from "lucide-react";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import type { Tables } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { calculerTotaux, eur, type LigneCommande } from "@/lib/commandes-fournisseur/format";
import { modifierSuiviCommande, supprimerCommandeFournisseur, envoyerCommandeParEmail } from "../actions";

type Commande = Tables<"commandes_fournisseur">;
type Devis = Tables<"devis"> | null;
type Fournisseur = Tables<"fournisseurs"> | null;

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

export function CommandeDetail({
  commande,
  devis,
  site,
  fournisseur,
}: {
  commande: Commande;
  devis: Devis;
  site: { nom: string; site: string } | null;
  fournisseur: Fournisseur;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [envoi, startEnvoi] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const interlocuteur = commande.interlocuteur as unknown as Interlocuteur;
  const lignes = (commande.lignes as unknown as LigneCommande[]) ?? [];
  const totaux = calculerTotaux(lignes, commande.taux_tva);
  const metropole = fournisseur?.localisation === "Métropole";

  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState(commande.date_livraison_prevue);
  const [livre, setLivre] = useState(commande.livre);
  const [arFournisseur, setArFournisseur] = useState(commande.ar_fournisseur);
  const [relance, setRelance] = useState(commande.relance);
  const [observations, setObservations] = useState(commande.observations);

  function enregistrerSuivi() {
    setErreur(null);
    startTransition(async () => {
      const res = await modifierSuiviCommande(commande.id, {
        date_livraison_prevue: dateLivraisonPrevue,
        livre,
        ar_fournisseur: arFournisseur,
        relance,
        observations,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  function envoyer() {
    setErreur(null);
    startEnvoi(async () => {
      const res = await envoyerCommandeParEmail(commande.id);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/commandes-fournisseur"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{commande.numero}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {fournisseur?.nom} — {[devis?.numero, site?.nom, site?.site].filter(Boolean).join(" — ")}
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a
          href={`/commandes-fournisseur/${commande.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" strokeWidth={2} />
          Voir le PDF
        </a>
        <button
          onClick={envoyer}
          disabled={envoi || !interlocuteur?.email}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          {envoi ? "Envoi..." : commande.envoyee_le ? "Renvoyer au fournisseur" : "Envoyer au fournisseur"}
        </button>
        <BoutonSupprimer
          action={supprimerCommandeFournisseur.bind(null, commande.id)}
          confirmation={`Supprimer définitivement la commande "${commande.numero}" ? Cette action est irréversible.`}
          redirectTo="/commandes-fournisseur"
        />
      </div>

      {commande.envoyee_le && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-brand-green-dark">
          Envoyée au fournisseur le {commande.envoyee_le}
        </p>
      )}
      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Fournisseur
        </p>
        <div className="space-y-0.5 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-900">{interlocuteur?.nom || "—"}</p>
          <p className="text-slate-600">{interlocuteur?.portable || interlocuteur?.tel}</p>
          <p className="text-slate-600">{interlocuteur?.email}</p>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          Articles
        </p>
        <div className="divide-y divide-slate-50">
          {lignes.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.designation}</span>
              <span className="shrink-0 text-slate-400">×{l.quantite}</span>
              <span className="shrink-0 font-medium text-slate-700">{l.prix_unitaire ? `${l.prix_unitaire} €` : ""}</span>
            </div>
          ))}
        </div>
        <div className="space-y-0.5 border-t border-slate-100 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Total HT</span>
            <span>{eur(totaux.ht)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>TVA ({commande.taux_tva}%)</span>
            <span>{eur(totaux.tva)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900">
            <span>Total TTC</span>
            <span>{eur(totaux.ttc)}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Suivi</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ETIQUETTE}>Date de livraison prévue</label>
            <input
              type="date"
              value={dateLivraisonPrevue}
              onChange={(e) => setDateLivraisonPrevue(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={livre} onChange={(e) => setLivre(e.target.checked)} className="h-4 w-4 accent-brand-green" />
              Livré
            </label>
          </div>
          <div>
            <label className={ETIQUETTE}>AR fournisseur</label>
            <input value={arFournisseur} onChange={(e) => setArFournisseur(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={ETIQUETTE}>Relance</label>
            <input value={relance} onChange={(e) => setRelance(e.target.value)} className={CHAMP} />
          </div>
          <div className="sm:col-span-2">
            <label className={ETIQUETTE}>Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
              className={CHAMP}
            />
          </div>
        </div>
        {metropole && (
          <p className="mt-2 text-xs text-slate-400">
            Port : {commande.port || "—"} · Incoterm : {commande.incoterm || "—"}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={enregistrerSuivi}
            disabled={pending}
            className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {pending ? "Enregistrement..." : "Enregistrer le suivi"}
          </button>
        </div>
      </div>
    </div>
  );
}
