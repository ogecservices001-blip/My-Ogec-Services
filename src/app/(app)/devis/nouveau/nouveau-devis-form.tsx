"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { creerDevis, listerEquipementsDuSite } from "../actions";
import {
  ligneDevisVide,
  coutRevientDefaut,
  calculerPrixRevient,
  prixUniteLigne,
  montantLigneDevis,
  totalHTLignes,
  type LigneDevis,
  type TypeLigneDevis,
  type CoutRevient,
} from "@/lib/devis/pricing";

type Option = { valeur: string; label: string };
type SiteOption = { id: string; nom: string; site: string; horsContrat: boolean };
type Equipement = { id: string; libelle: string };

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const CHAMP_SM = "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";
const MAX_LIGNES = 30;

function eur(v: number): string {
  const [entier, decimales] = Math.abs(v).toFixed(2).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "-" : ""}${groupes},${decimales} €`;
}

const LABELS_TYPE: Record<TypeLigneDevis, string> = {
  normal: "Normal",
  sous_traitant: "Sous-traitant ×1,25",
  code2: "Code N°2 ×1,15",
};

type Prefill = {
  equipementId: string;
  siteId: string;
  clientNom: string;
  type: "sous" | "hors";
  compteRendu: string;
} | null;

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
  const [libelle, setLibelle] = useState(prefill?.compteRendu ?? "");
  const [nature, setNature] = useState("");

  const [lignes, setLignes] = useState<LigneDevis[]>([ligneDevisVide()]);
  const [coutRevient, setCoutRevient] = useState<CoutRevient>(coutRevientDefaut());
  const [feuilleDeVenteOuverte, setFeuilleDeVenteOuverte] = useState(false);

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

  function majLigne(i: number, champs: Partial<LigneDevis>) {
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...champs } : l)));
  }

  function majCout(champ: keyof CoutRevient, valeur: string) {
    setCoutRevient((prev) => ({ ...prev, [champ]: valeur }));
  }

  const lignesValides = useMemo(() => lignes.filter((l) => l.designation.trim()), [lignes]);
  const prixRevient = useMemo(() => calculerPrixRevient(lignesValides, coutRevient), [lignesValides, coutRevient]);
  const totalHT = useMemo(
    () => totalHTLignes(lignesValides, prixRevient.coefficientVente, prixRevient.tauxHoraire),
    [lignesValides, prixRevient],
  );
  const tva = Math.round(totalHT * 0.085 * 100) / 100;
  const ttc = totalHT + tva;

  const complet = Boolean(siteId && libelle.trim() && nature && lignesValides.length > 0);

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const res = await creerDevis({
        siteId,
        libelle,
        nature,
        equipementId: equipementId || null,
        lignes: lignesValides,
        coutRevient,
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
    <div>
      {prefill && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Pré-rempli depuis &quot;Devis à établir&quot;
        </p>
      )}

      <div className="mb-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className={ETIQUETTE}>Type de client *</label>
          <select value={type} onChange={(e) => changerType(e.target.value as "" | "sous" | "hors")} className={CHAMP}>
            <option value="">— Choisir —</option>
            <option value="sous">Client sous contrat</option>
            <option value="hors">Client hors contrat</option>
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Client *</label>
          <select value={clientNom} onChange={(e) => changerClient(e.target.value)} disabled={!type} className={`${CHAMP} disabled:bg-slate-50`}>
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
          <select value={siteId} onChange={(e) => changerSite(e.target.value)} disabled={!clientNom} className={`${CHAMP} disabled:bg-slate-50`}>
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
      </div>

      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Lignes d&apos;articles</h2>
          {lignes.length < MAX_LIGNES && (
            <button
              type="button"
              onClick={() => setLignes((prev) => [...prev, ligneDevisVide()])}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Ligne
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[2fr_0.7fr_0.6fr_0.8fr_0.7fr_1.2fr_0.9fr_0.9fr_auto] gap-1.5 px-1 text-[11px] font-semibold text-slate-400 sm:grid">
            <span>Désignation</span>
            <span>Unité</span>
            <span>Qté</span>
            <span>Matière €</span>
            <span>MO (h)</span>
            <span>Type</span>
            <span className="text-right">PU calculé</span>
            <span className="text-right">Montant</span>
            <span />
          </div>
          {lignes.map((l, i) => {
            const pu = prixUniteLigne(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            const montant = montantLigneDevis(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            return (
              <div key={i} className="grid grid-cols-[2fr_0.7fr_0.6fr_0.8fr_0.7fr_1.2fr_0.9fr_0.9fr_auto] items-center gap-1.5">
                <input value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })} placeholder="Désignation" className={CHAMP_SM} />
                <input value={l.unite} onChange={(e) => majLigne(i, { unite: e.target.value })} placeholder="U" className={CHAMP_SM} />
                <input value={l.quantite} onChange={(e) => majLigne(i, { quantite: e.target.value })} placeholder="Qté" className={CHAMP_SM} />
                <input value={l.matiere} onChange={(e) => majLigne(i, { matiere: e.target.value })} placeholder="0" className={CHAMP_SM} />
                <input value={l.moHeures} onChange={(e) => majLigne(i, { moHeures: e.target.value })} placeholder="0" className={CHAMP_SM} />
                <select value={l.type} onChange={(e) => majLigne(i, { type: e.target.value as TypeLigneDevis })} className={CHAMP_SM}>
                  {(Object.entries(LABELS_TYPE) as [TypeLigneDevis, string][]).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="truncate text-right text-sm text-slate-600">{pu !== null ? eur(pu) : ""}</p>
                <p className="truncate text-right text-sm font-medium text-slate-900">{montant !== null ? eur(montant) : ""}</p>
                <button
                  type="button"
                  onClick={() => setLignes((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lignes.length === 1}
                  className="text-red-500 transition hover:text-red-700 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <button type="button" onClick={() => setFeuilleDeVenteOuverte((v) => !v)} className="flex w-full items-center justify-between text-left">
          <h2 className="text-sm font-bold text-slate-900">Feuille de vente — coût de revient, marge, prix de vente</h2>
          <span className="text-xs font-semibold text-brand-green-dark">{feuilleDeVenteOuverte ? "Replier" : "Déplier"}</span>
        </button>

        {feuilleDeVenteOuverte && (
          <div className="mt-4 space-y-5">
            <BlocCout titre="R1 — Fourniture & Sous-traitance">
              <ChampLecture label="Matière (somme des lignes)" valeur={eur(prixRevient.materiel)} />
              <ChampCout label="Sous-traitance (€)" valeur={coutRevient.r1SousTraitance} onChange={(v) => majCout("r1SousTraitance", v)} />
              <ChampCout label="Divers (€)" valeur={coutRevient.r1Divers} onChange={(v) => majCout("r1Divers", v)} />
            </BlocCout>

            <BlocCout titre="R2 — Montage">
              <ChampLecture label="Heures (somme des lignes)" valeur={`${prixRevient.heuresMO} h`} />
              <ChampCout label="Taux horaire (€/h)" valeur={coutRevient.r2TauxHoraire} onChange={(v) => majCout("r2TauxHoraire", v)} />
            </BlocCout>

            <BlocCout titre="R3 — Chantier">
              <ChampCout label="Nacelle (€)" valeur={coutRevient.r3Nacelle} onChange={(v) => majCout("r3Nacelle", v)} />
              <ChampCout label="Déplacement (€)" valeur={coutRevient.r3Deplacement} onChange={(v) => majCout("r3Deplacement", v)} />
              <ChampCout label="Outillage (€)" valeur={coutRevient.r3Outillage} onChange={(v) => majCout("r3Outillage", v)} />
              <ChampCout label="Manutention / Grutage (€)" valeur={coutRevient.r3Manutention} onChange={(v) => majCout("r3Manutention", v)} />
              <ChampCout label="Encadrement (€)" valeur={coutRevient.r3Encadrement} onChange={(v) => majCout("r3Encadrement", v)} />
              <ChampCout label="Essais (€)" valeur={coutRevient.r3Essais} onChange={(v) => majCout("r3Essais", v)} />
              <ChampCout label="Garantie S.A.V. (€)" valeur={coutRevient.r3GarantieSav} onChange={(v) => majCout("r3GarantieSav", v)} />
              <ChampCout label="Paniers (€)" valeur={coutRevient.r3Paniers} onChange={(v) => majCout("r3Paniers", v)} />
            </BlocCout>

            <BlocCout titre="R4 — Études">
              <ChampCout label="Synthèse d'études (€)" valeur={coutRevient.r4SyntheseEtudes} onChange={(v) => majCout("r4SyntheseEtudes", v)} />
              <ChampCout label="Tirage de plans (€)" valeur={coutRevient.r4TirageDePlans} onChange={(v) => majCout("r4TirageDePlans", v)} />
              <ChampCout label="Dessin sous-traité (€)" valeur={coutRevient.r4DessinSousTraite} onChange={(v) => majCout("r4DessinSousTraite", v)} />
              <ChampCout label="Encadrement (€)" valeur={coutRevient.r4Encadrement} onChange={(v) => majCout("r4Encadrement", v)} />
              <ChampCout label="Bilan thermique (€)" valeur={coutRevient.r4BilanThermique} onChange={(v) => majCout("r4BilanThermique", v)} />
            </BlocCout>

            <BlocCout titre="R5 — Frais divers (% du prix de vente)">
              <ChampCout label="Cautionnement (%)" valeur={coutRevient.r5CautionnementPct} onChange={(v) => majCout("r5CautionnementPct", v)} />
              <ChampCout label="Contrat entretien (%)" valeur={coutRevient.r5ContratEntretienPct} onChange={(v) => majCout("r5ContratEntretienPct", v)} />
              <ChampCout label="Fournitures administratives (%)" valeur={coutRevient.r5FournituresAdminPct} onChange={(v) => majCout("r5FournituresAdminPct", v)} />
              <ChampCout label="Compte prorata (%)" valeur={coutRevient.r5CompteProrataPct} onChange={(v) => majCout("r5CompteProrataPct", v)} />
              <ChampCout label="EPI (%)" valeur={coutRevient.r5EpiPct} onChange={(v) => majCout("r5EpiPct", v)} />
              <ChampCout label="Essais Coprec (%)" valeur={coutRevient.r5EssaisCoprecPct} onChange={(v) => majCout("r5EssaisCoprecPct", v)} />
              <ChampCout label="Formations salariales (%)" valeur={coutRevient.r5FormationsPct} onChange={(v) => majCout("r5FormationsPct", v)} />
              <ChampCout label="Assurances (%)" valeur={coutRevient.r5AssurancesPct} onChange={(v) => majCout("r5AssurancesPct", v)} />
              <ChampCout label="Frais commerciaux (%)" valeur={coutRevient.r5FraisCommerciauxPct} onChange={(v) => majCout("r5FraisCommerciauxPct", v)} />
              <ChampCout label="Décennale (%)" valeur={coutRevient.r5DecennalePct} onChange={(v) => majCout("r5DecennalePct", v)} />
            </BlocCout>

            <BlocCout titre="Marge">
              <ChampCout label="Marge brute cible (%)" valeur={coutRevient.margeCiblePct} onChange={(v) => majCout("margeCiblePct", v)} />
            </BlocCout>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Récapitulation prix de revient</p>
              <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <LigneRecap label="R1 Fourniture & S/Trait." valeur={eur(prixRevient.r1Total)} />
                <LigneRecap label="R2 Montage" valeur={eur(prixRevient.r2Total)} />
                <LigneRecap label="R3 Frais de chantier" valeur={eur(prixRevient.r3Total)} />
                <LigneRecap label="R4 Frais d'étude" valeur={eur(prixRevient.r4Total)} />
                <LigneRecap label="Coût avant frais divers" valeur={eur(prixRevient.coutAvantFraisDivers)} fort />
                <LigneRecap label="R5 Frais divers" valeur={eur(prixRevient.r5Total)} />
                <LigneRecap label="Marge brute" valeur={eur(prixRevient.margeBrute)} />
                <LigneRecap label="Coefficient de vente" valeur={prixRevient.coefficientVente.toFixed(5)} />
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-bold text-slate-900">Prix de vente (Feuille de vente)</span>
                <span className="text-lg font-bold text-slate-900">{eur(prixRevient.prixDeVente)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Totaux</h2>
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Total HT (lignes)</span>
            <span className="font-medium text-slate-900">{eur(totalHT)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">TVA (8,5%)</span>
            <span className="font-medium text-slate-900">{eur(tva)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-1">
            <span className="font-bold text-slate-900">Total TTC</span>
            <span className="font-bold text-slate-900">{eur(ttc)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-xs text-slate-400">
            <span>Prix de vente calculé (Feuille de vente)</span>
            <span>{eur(prixRevient.prixDeVente)}</span>
          </div>
        </div>
      </div>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <div className="flex justify-end gap-2 pb-8">
        <Link href="/devis" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
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
  );
}

function BlocCout({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{titre}</p>
      <div className="grid gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function ChampCout({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input value={valeur} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className={CHAMP_SM} />
    </div>
  );
}

function ChampLecture({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-sm text-slate-500">{valeur}</p>
    </div>
  );
}

function LigneRecap({ label, valeur, fort }: { label: string; valeur: string; fort?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={fort ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</span>
      <span className={fort ? "font-semibold text-slate-900" : "text-slate-700"}>{valeur}</span>
    </div>
  );
}
