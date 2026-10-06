"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { creerDevis, listerEquipementsDuSite } from "../actions";

type Option = { valeur: string; label: string };
type SiteOption = { id: string; label: string };
type Equipement = { id: string; nom: string; numero_equipement: string };

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

export function NouveauDevisForm({ sites, natures }: { sites: SiteOption[]; natures: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [siteId, setSiteId] = useState("");
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  const [equipementId, setEquipementId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [nature, setNature] = useState("");
  const [montant, setMontant] = useState("");
  const [heures, setHeures] = useState("");

  function changerSite(id: string) {
    setSiteId(id);
    setEquipementId("");
    setEquipements([]);
    if (!id) return;
    startTransition(async () => {
      setEquipements(await listerEquipementsDuSite(id));
    });
  }

  const complet = Boolean(siteId && libelle.trim() && nature && montant.trim());

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const res = await creerDevis({
        siteId,
        libelle,
        nature,
        montant: Number(montant.replace(",", ".")),
        heuresPrevues: heures.trim() ? Number(heures.replace(",", ".")) : null,
        equipementId: equipementId || null,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push("/devis");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/devis"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">Nouveau devis</h1>

      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className={ETIQUETTE}>Site *</label>
          <select value={siteId} onChange={(e) => changerSite(e.target.value)} className={CHAMP}>
            <option value="">— Choisir un site —</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Équipement concerné (facultatif)</label>
          <select
            value={equipementId}
            onChange={(e) => setEquipementId(e.target.value)}
            disabled={!siteId || equipements.length === 0}
            className={`${CHAMP} disabled:bg-slate-50`}
          >
            <option value="">— aucun —</option>
            {equipements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
                {e.numero_equipement ? ` (${e.numero_equipement})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Libellé *</label>
          <textarea value={libelle} onChange={(e) => setLibelle(e.target.value)} rows={2} className={CHAMP} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ETIQUETTE}>Nature *</label>
            <select value={nature} onChange={(e) => setNature(e.target.value)} className={CHAMP}>
              <option value="">— Choisir —</option>
              {natures.map((n) => (
                <option key={n.valeur} value={n.valeur}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={ETIQUETTE}>Montant (€) *</label>
            <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" className={CHAMP} />
          </div>
        </div>

        <div>
          <label className={ETIQUETTE}>Heures prévues (facultatif)</label>
          <input value={heures} onChange={(e) => setHeures(e.target.value)} inputMode="decimal" className={CHAMP} />
        </div>

        {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href="/devis"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </Link>
          <button
            onClick={enregistrer}
            disabled={!complet || pending}
            className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
          >
            {pending ? "Enregistrement..." : "Créer le devis"}
          </button>
        </div>
      </div>
    </div>
  );
}
