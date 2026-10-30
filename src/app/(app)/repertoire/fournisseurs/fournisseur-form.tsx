"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ScanLine } from "lucide-react";
import { champsFournisseur, type FournisseurInput, type Interlocuteur } from "@/lib/validation/fournisseur";
import { creerFournisseur, modifierFournisseur, analyserFournisseurDepuisDevis } from "./actions";
import type { Fournisseur } from "@/lib/types";

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

const INTERLOCUTEUR_VIDE: Interlocuteur = { nom: "", tel: "", portable: "", email: "" };

export function FournisseurForm({ fournisseur }: { fournisseur?: Fournisseur }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [champs, setChamps] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of champsFournisseur) {
      if (c.cle === "interlocuteurs") continue;
      init[c.cle] = fournisseur ? String(fournisseur[c.cle as keyof Fournisseur] ?? "") : "";
    }
    return init;
  });

  const [interlocuteurs, setInterlocuteurs] = useState<Interlocuteur[]>(
    () => (fournisseur?.interlocuteurs as unknown as Interlocuteur[] | null) ?? [],
  );

  function majInterlocuteur(i: number, champ: keyof Interlocuteur, valeur: string) {
    setInterlocuteurs((prev) => prev.map((it, idx) => (idx === i ? { ...it, [champ]: valeur } : it)));
  }

  const fichierRef = useRef<HTMLInputElement>(null);
  const [analyse, startAnalyse] = useTransition();
  const [erreurAnalyse, setErreurAnalyse] = useState<string | null>(null);

  function analyserFichier() {
    const fichier = fichierRef.current?.files?.[0];
    if (!fichier) return;
    setErreurAnalyse(null);
    const formData = new FormData();
    formData.set("fichier", fichier);
    startAnalyse(async () => {
      const res = await analyserFournisseurDepuisDevis(formData);
      if (!res.ok) {
        setErreurAnalyse(res.erreur);
        return;
      }
      const r = res.resultat;
      setChamps((prev) => ({
        ...prev,
        nom: r.nom || prev.nom,
        nature_fourniture: r.nature_fourniture || prev.nature_fourniture,
        site_web: r.site_web || prev.site_web,
        adresse: r.adresse || prev.adresse,
        complement_adresse: r.complement_adresse || prev.complement_adresse,
        code_postal: r.code_postal || prev.code_postal,
        commune: r.commune || prev.commune,
        raison_sociale_exacte: r.raison_sociale_exacte || prev.raison_sociale_exacte,
        forme_juridique: r.forme_juridique || prev.forme_juridique,
        siren: r.siren || prev.siren,
        siret: r.siret || prev.siret,
        tva_intracom: r.tva_intracom || prev.tva_intracom,
        rcs_rm: r.rcs_rm || prev.rcs_rm,
        delai_paiement: r.delai_paiement || prev.delai_paiement,
        mode_reglement: r.mode_reglement || prev.mode_reglement,
      }));
      if (r.interlocuteurs.length > 0) {
        setInterlocuteurs((prev) => [...prev, ...r.interlocuteurs.filter((i) => i.nom || i.tel || i.portable || i.email)]);
      }
      if (fichierRef.current) fichierRef.current.value = "";
    });
  }

  function soumettre() {
    if (!champs.nom?.trim()) {
      setErreur("Le nom du fournisseur est obligatoire.");
      return;
    }
    setErreur(null);

    const input: FournisseurInput = {
      ...(champs as Omit<FournisseurInput, "interlocuteurs">),
      interlocuteurs: interlocuteurs.filter((i) => i.nom || i.tel || i.portable || i.email),
    };

    startTransition(async () => {
      const res = fournisseur ? await modifierFournisseur(fournisseur.id, input) : await creerFournisseur(input);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push(fournisseur ? `/repertoire/fournisseurs/${fournisseur.id}` : "/repertoire/fournisseurs");
      router.refresh();
    });
  }

  return (
    <div>
      {erreur && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>
      )}

      {!fournisseur && (
        <div className="mb-5 border-b border-slate-100 pb-5">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <ScanLine className="h-4 w-4 text-brand-green-dark" strokeWidth={2.25} />
            Scanner un devis / une facture
          </h2>
          <p className="mb-2 text-xs text-slate-500">
            Pré-remplit la fiche à partir d&apos;un devis ou d&apos;une facture de ce fournisseur (PDF, photo ou
            capture d&apos;écran) — à relire avant d&apos;enregistrer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fichierRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="text-sm text-slate-600" />
            <button
              type="button"
              onClick={analyserFichier}
              disabled={analyse}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {analyse ? "Lecture..." : "Lire le document"}
            </button>
          </div>
          {erreurAnalyse && <p className="mt-2 text-xs text-red-600">{erreurAnalyse}</p>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {champsFournisseur.map((champ) => (
          <div key={champ.cle}>
            <label htmlFor={champ.cle} className={ETIQUETTE}>
              {champ.label}
            </label>
            <input
              id={champ.cle}
              value={champs[champ.cle] ?? ""}
              onChange={(e) => setChamps((prev) => ({ ...prev, [champ.cle]: e.target.value }))}
              className={CHAMP}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Interlocuteurs</h2>
          <button
            type="button"
            onClick={() => setInterlocuteurs((prev) => [...prev, { ...INTERLOCUTEUR_VIDE }])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Ajouter
          </button>
        </div>

        {interlocuteurs.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun interlocuteur.</p>
        ) : (
          <div className="space-y-3">
            {interlocuteurs.map((it, i) => (
              <div key={i} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Interlocuteur {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInterlocuteurs((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-500 transition hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className={ETIQUETTE}>Nom</label>
                    <input
                      value={it.nom}
                      onChange={(e) => majInterlocuteur(i, "nom", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Email</label>
                    <input
                      value={it.email}
                      onChange={(e) => majInterlocuteur(i, "email", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Tél fixe</label>
                    <input
                      value={it.tel}
                      onChange={(e) => majInterlocuteur(i, "tel", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div>
                    <label className={ETIQUETTE}>Portable</label>
                    <input
                      value={it.portable}
                      onChange={(e) => majInterlocuteur(i, "portable", e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={soumettre}
          disabled={pending}
          className="rounded-xl bg-brand-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
