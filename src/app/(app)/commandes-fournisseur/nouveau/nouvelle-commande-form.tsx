"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { Fournisseur } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { INCOTERMS, tauxTvaDefaut } from "@/lib/commandes-fournisseur/constants";
import { ligneVide, montantLigne, calculerTotaux, eur, type LigneCommande } from "@/lib/commandes-fournisseur/format";
import { creerCommandeFournisseur } from "../actions";

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";
const MAX_LIGNES = 20;

function interlocuteursDe(f: Fournisseur | undefined): Interlocuteur[] {
  return (f?.interlocuteurs as unknown as Interlocuteur[] | null) ?? [];
}

export function NouvelleCommandeForm({
  devis,
  site,
  fournisseurs,
}: {
  devis: { id: string; numero: string; libelle: string };
  site: { nom: string; site: string } | null;
  fournisseurs: Fournisseur[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [fournisseurId, setFournisseurId] = useState("");
  const fournisseur = fournisseurs.find((f) => f.id === fournisseurId);
  const interlocuteurs = interlocuteursDe(fournisseur);
  const [interlocuteurIndex, setInterlocuteurIndex] = useState(0);
  const metropole = fournisseur?.localisation === "Métropole";

  const [tauxTva, setTauxTva] = useState(0);
  const [devisFournisseurNumero, setDevisFournisseurNumero] = useState("");
  const [devisFournisseurDate, setDevisFournisseurDate] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState("");
  const [port, setPort] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [lignes, setLignes] = useState<LigneCommande[]>([ligneVide()]);

  function choisirFournisseur(id: string) {
    setFournisseurId(id);
    const f = fournisseurs.find((x) => x.id === id);
    setInterlocuteurIndex(0);
    setTauxTva(tauxTvaDefaut(f?.localisation ?? ""));
  }

  function majLigne(i: number, champ: keyof LigneCommande, valeur: string) {
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, [champ]: valeur } : l)));
  }

  const totaux = useMemo(() => calculerTotaux(lignes, tauxTva), [lignes, tauxTva]);

  function soumettre() {
    if (!fournisseurId) {
      setErreur("Choisis un fournisseur.");
      return;
    }
    if (interlocuteurs.length > 0 && !interlocuteurs[interlocuteurIndex]) {
      setErreur("Choisis un interlocuteur.");
      return;
    }
    if (!lignes.some((l) => l.designation.trim())) {
      setErreur("Ajoute au moins une ligne d'article.");
      return;
    }
    setErreur(null);

    startTransition(async () => {
      const res = await creerCommandeFournisseur({
        devisId: devis.id,
        fournisseurId,
        interlocuteur: interlocuteurs[interlocuteurIndex] ?? { nom: "", tel: "", portable: "", email: "" },
        lignes,
        tauxTva,
        devisFournisseurNumero,
        devisFournisseurDate,
        adresseLivraison,
        dateLivraisonPrevue,
        port,
        incoterm,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push(`/commandes-fournisseur/${res.id}`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/devis/${devis.id}/statut`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour au devis
      </Link>
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">Nouveau bon de commande</h1>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="font-bold text-slate-900">{devis.numero}</p>
        <p className="text-sm font-semibold text-slate-700">{[site?.nom, site?.site].filter(Boolean).join(" — ")}</p>
        {devis.libelle && <p className="text-sm text-slate-500">{devis.libelle}</p>}
      </div>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ETIQUETTE}>Fournisseur</label>
            <select value={fournisseurId} onChange={(e) => choisirFournisseur(e.target.value)} className={CHAMP}>
              <option value="">— choisir —</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          {interlocuteurs.length > 1 && (
            <div>
              <label className={ETIQUETTE}>Interlocuteur</label>
              <select
                value={interlocuteurIndex}
                onChange={(e) => setInterlocuteurIndex(Number(e.target.value))}
                className={CHAMP}
              >
                {interlocuteurs.map((it, i) => (
                  <option key={i} value={i}>
                    {it.nom || `Interlocuteur ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {fournisseurId && interlocuteurs.length === 0 && (
            <p className="self-end text-xs text-amber-600">Aucun interlocuteur enregistré pour ce fournisseur.</p>
          )}
          <div>
            <label className={ETIQUETTE}>Devis fournisseur n°</label>
            <input value={devisFournisseurNumero} onChange={(e) => setDevisFournisseurNumero(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={ETIQUETTE}>Devis fournisseur en date du</label>
            <input
              type="date"
              value={devisFournisseurDate}
              onChange={(e) => setDevisFournisseurDate(e.target.value)}
              className={CHAMP}
            />
          </div>
          <div>
            <label className={ETIQUETTE}>Taux de TVA (%)</label>
            <input
              type="number"
              step="0.1"
              value={tauxTva}
              onChange={(e) => setTauxTva(parseFloat(e.target.value) || 0)}
              className={CHAMP}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Livraison</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={ETIQUETTE}>Adresse de livraison</label>
            <input value={adresseLivraison} onChange={(e) => setAdresseLivraison(e.target.value)} className={CHAMP} />
          </div>
          <div>
            <label className={ETIQUETTE}>Date de livraison prévue</label>
            <input
              type="date"
              value={dateLivraisonPrevue}
              onChange={(e) => setDateLivraisonPrevue(e.target.value)}
              className={CHAMP}
            />
          </div>
          {metropole && (
            <>
              <div>
                <label className={ETIQUETTE}>Port (frais de livraison)</label>
                <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Ex : Port payé par OGEC" className={CHAMP} />
              </div>
              <div>
                <label className={ETIQUETTE}>Incoterm</label>
                <select value={incoterm} onChange={(e) => setIncoterm(e.target.value)} className={CHAMP}>
                  <option value="">— aucun —</option>
                  {INCOTERMS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Articles</h2>
          {lignes.length < MAX_LIGNES && (
            <button
              type="button"
              onClick={() => setLignes((prev) => [...prev, ligneVide()])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Ligne
            </button>
          )}
        </div>

        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_0.6fr_0.8fr_0.8fr_auto] items-center gap-1.5">
              <input value={l.code} onChange={(e) => majLigne(i, "code", e.target.value)} placeholder="Code" className={CHAMP} />
              <input
                value={l.designation}
                onChange={(e) => majLigne(i, "designation", e.target.value)}
                placeholder="Désignation"
                className={CHAMP}
              />
              <input value={l.quantite} onChange={(e) => majLigne(i, "quantite", e.target.value)} placeholder="Qté" className={CHAMP} />
              <input
                value={l.prix_unitaire}
                onChange={(e) => majLigne(i, "prix_unitaire", e.target.value)}
                placeholder="PU HT"
                className={CHAMP}
              />
              <p className="truncate text-right text-sm text-slate-600">
                {montantLigne(l) !== null ? eur(montantLigne(l)!) : ""}
              </p>
              <button
                type="button"
                onClick={() => setLignes((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={lignes.length === 1}
                className="text-red-500 transition hover:text-red-700 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 ml-auto w-full max-w-[260px] space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Total HT</span>
            <span className="font-medium text-slate-900">{eur(totaux.ht)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">TVA ({tauxTva}%)</span>
            <span className="font-medium text-slate-900">{eur(totaux.tva)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <span className="font-bold text-slate-900">Total TTC</span>
            <span className="font-bold text-slate-900">{eur(totaux.ttc)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={soumettre}
          disabled={pending}
          className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Créer la commande"}
        </button>
      </div>
    </div>
  );
}
