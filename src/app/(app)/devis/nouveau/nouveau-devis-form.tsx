"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { creerDevis, listerEquipementsDuSite } from "../actions";

type Option = { valeur: string; label: string };
type SiteOption = { id: string; nom: string; site: string; horsContrat: boolean };
type Equipement = { id: string; libelle: string };

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

type Prefill = { equipementId: string; siteId: string; clientNom: string; type: "sous" | "hors" } | null;

export function NouveauDevisForm({
  sites,
  natures,
  prefill,
}: {
  sites: SiteOption[];
  natures: Option[];
  prefill: Prefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [type, setType] = useState<"" | "sous" | "hors">(prefill?.type ?? "");
  const [clientNom, setClientNom] = useState(prefill?.clientNom ?? "");
  const sitesDuType = type ? sites.filter((s) => s.horsContrat === (type === "hors")) : [];
  const clients = [...new Set(sitesDuType.map((s) => s.nom))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const sitesDuClient = clientNom ? sitesDuType.filter((s) => s.nom === clientNom) : [];

  const [siteId, setSiteId] = useState(prefill?.siteId ?? "");
  const [equipements, setEquipements] = useState<Equipement[]>([]);
  const [equipementId, setEquipementId] = useState(prefill?.equipementId ?? "");

  useEffect(() => {
    if (!prefill) return;
    startTransition(async () => {
      setEquipements(await listerEquipementsDuSite(prefill.siteId));
    });
    // Pré-remplissage ponctuel au chargement (depuis "Devis à établir"),
    // pas une synchro continue — pas de dépendances à surveiller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [libelle, setLibelle] = useState("");
  const [nature, setNature] = useState("");
  const [montant, setMontant] = useState("");
  const [heures, setHeures] = useState("");

  function changerType(valeur: "" | "sous" | "hors") {
    setType(valeur);
    setClientNom("");
    changerSite("");
  }

  function changerClient(nom: string) {
    setClientNom(nom);
    changerSite("");
  }

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

      {prefill && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Pré-rempli depuis &quot;Devis à établir&quot;
        </p>
      )}

      <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className={ETIQUETTE}>Type de client *</label>
          <select
            value={type}
            onChange={(e) => changerType(e.target.value as "" | "sous" | "hors")}
            className={CHAMP}
          >
            <option value="">— Choisir —</option>
            <option value="sous">Client sous contrat</option>
            <option value="hors">Client hors contrat</option>
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Client *</label>
          <select
            value={clientNom}
            onChange={(e) => changerClient(e.target.value)}
            disabled={!type}
            className={`${CHAMP} disabled:bg-slate-50`}
          >
            <option value="">— Choisir un client —</option>
            {clients.map((nom) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Site *</label>
          <select
            value={siteId}
            onChange={(e) => changerSite(e.target.value)}
            disabled={!clientNom}
            className={`${CHAMP} disabled:bg-slate-50`}
          >
            <option value="">— Choisir un site —</option>
            {sitesDuClient.map((s) => (
              <option key={s.id} value={s.id}>
                {s.site || "(sans nom de site)"}
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
                {e.libelle}
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
