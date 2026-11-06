"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { creerDevis, enregistrerBrouillonDevis, listerEquipementsDuSite, reviserDevis } from "../actions";
import {
  ligneDevisVide,
  coutRevientDefaut,
  calculerPrixRevient,
  prixUniteLigne,
  montantLigneDevis,
  totalHTLignes,
  montantRemise,
  remiseActive,
  remiseVide,
  libelleRemise,
  type LigneDevis,
  type TypeLigneDevis,
  type CoutRevient,
  type RemiseDevis,
  type TypeRemise,
} from "@/lib/devis/pricing";
import type { PaveDevis } from "@/lib/devis/paves";
import { useChampManquant, type CibleChamp } from "@/components/champ-manquant";

type Option = { valeur: string; label: string };
type SiteOption = { id: string; nom: string; site: string; horsContrat: boolean };
type Equipement = { id: string; libelle: string; localisation: string; groupe: string };

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

const UNITES = ["U", "Ens", "Ft", "ml", "kg"];

type Prefill = {
  siteId: string;
  clientNom: string;
  type: "sous" | "hors";
  paves: PaveDevis[];
  signalementBi: string;
  equipementSignale: string;
} | null;

type Brouillon = {
  id: string;
  siteId: string;
  clientNom: string;
  type: "sous" | "hors";
  paves: PaveDevis[];
  coutRevient: CoutRevient;
  remise?: RemiseDevis;
} | null;

type Revision = { indiceSuivant: string; commande: boolean };

/// Pavé en cours de saisie. `cle` et `groupeFiltre` ne sont jamais enregistrés.
type PaveSaisie = Omit<PaveDevis, "equipementId"> & { cle: number; equipementId: string; groupeFiltre: string };

function lignesVides(): LigneDevis[] {
  return [ligneDevisVide(), ligneDevisVide(), ligneDevisVide(), ligneDevisVide(), ligneDevisVide()];
}

function versSaisie(pave: PaveDevis, cle: number): PaveSaisie {
  return {
    ...pave,
    cle,
    equipementId: pave.equipementId ?? "",
    groupeFiltre: "",
    lignes: pave.lignes.length > 0 ? pave.lignes : lignesVides(),
  };
}

function paveVide(cle: number): PaveSaisie {
  return versSaisie({ equipementId: null, equipementNom: "", localisation: "", libelle: "", nature: "", lignes: [] }, cle);
}

export function NouveauDevisForm({
  sites,
  natures,
  prefill,
  brouillon,
  revision,
}: {
  sites: SiteOption[];
  natures: Option[];
  prefill: Prefill;
  brouillon?: Brouillon;
  revision?: Revision;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enregistrementBrouillon, startEnregistrementBrouillon] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [brouillonId, setBrouillonId] = useState(brouillon?.id ?? null);
  const [brouillonConfirme, setBrouillonConfirme] = useState(false);

  const [type, setType] = useState<"" | "sous" | "hors">(brouillon?.type ?? prefill?.type ?? "");
  const [clientNom, setClientNom] = useState(brouillon?.clientNom ?? prefill?.clientNom ?? "");
  const sitesDuType = type ? sites.filter((s) => s.horsContrat === (type === "hors")) : [];
  const clients = [...new Set(sitesDuType.map((s) => s.nom))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const sitesDuClient = clientNom ? sitesDuType.filter((s) => s.nom === clientNom) : [];

  const [siteId, setSiteId] = useState(brouillon?.siteId ?? prefill?.siteId ?? "");
  const [equipements, setEquipements] = useState<Equipement[]>([]);

  const pavesInitiaux = brouillon?.paves ?? prefill?.paves ?? [];
  const [paves, setPaves] = useState<PaveSaisie[]>(
    pavesInitiaux.length > 0 ? pavesInitiaux.map(versSaisie) : [paveVide(0)],
  );
  const prochaineCle = useRef(pavesInitiaux.length + 1);

  useEffect(() => {
    const siteADeterminer = brouillon?.siteId ?? prefill?.siteId;
    if (!siteADeterminer) return;
    startTransition(async () => {
      setEquipements(await listerEquipementsDuSite(siteADeterminer));
    });
    // Pré-remplissage ponctuel au chargement (brouillon repris, ou
    // "Devis à établir"), pas une synchro continue — pas de dépendances
    // à surveiller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [coutRevient, setCoutRevient] = useState<CoutRevient>(brouillon?.coutRevient ?? coutRevientDefaut());
  const [feuilleDeVenteOuverte, setFeuilleDeVenteOuverte] = useState(true);
  const [remise, setRemise] = useState<RemiseDevis>(brouillon?.remise ?? remiseVide());

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
    setEquipements([]);
    setPaves((prev) => prev.map((p) => ({ ...p, equipementId: "", equipementNom: "", groupeFiltre: "", localisation: "" })));
    if (!id) return;
    startTransition(async () => {
      setEquipements(await listerEquipementsDuSite(id));
    });
  }

  function majPave(i: number, champs: Partial<PaveSaisie>) {
    setPaves((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...champs } : p)));
  }

  function ajouterPave() {
    const cle = prochaineCle.current;
    prochaineCle.current += 1;
    setPaves((prev) => [...prev, paveVide(cle)]);
  }

  function majCout(champ: keyof CoutRevient, valeur: string) {
    setCoutRevient((prev) => ({ ...prev, [champ]: valeur }));
  }

  // Une seule Feuille de vente pour tout le devis : le coefficient se calcule
  // sur les lignes de tous les pavés.
  const lignesValides = useMemo(() => paves.flatMap((p) => p.lignes).filter((l) => l.designation.trim()), [paves]);
  const prixRevient = useMemo(() => calculerPrixRevient(lignesValides, coutRevient), [lignesValides, coutRevient]);
  const totalHT = useMemo(
    () => totalHTLignes(lignesValides, prixRevient.coefficientVente, prixRevient.tauxHoraire),
    [lignesValides, prixRevient],
  );
  const remiseEuros = montantRemise(totalHT, remise);
  const totalNet = totalHT - remiseEuros;
  const tva = Math.round(totalNet * 0.085 * 100) / 100;
  const ttc = totalNet + tva;

  // Déplacement/Encadrement/Garantie S.A.V. (R3) et Encadrement (R4) se
  // calculent tous à partir de la même base (montant des heures +
  // montant fourniture) — un seul bouton les remplit, toujours
  // modifiables ensuite à la main.
  function calculerChampsR3R4() {
    const base = prixRevient.r2Total + prixRevient.materiel;
    const arrondi = (pct: number) => String(Math.round(base * pct * 100) / 100);
    setCoutRevient((prev) => ({
      ...prev,
      r3Deplacement: arrondi(0.018),
      r3Encadrement: arrondi(0.025),
      r3GarantieSav: arrondi(0.025),
      r4Encadrement: arrondi(0.025),
    }));
  }

  const { signaler, fenetre } = useChampManquant();

  function manqueSite(): [string, CibleChamp] | null {
    if (!type) return ["Choisis le type de client", "devis-type"];
    if (!clientNom) return ["Choisis le client", "devis-client"];
    if (!siteId) return ["Choisis le site", "devis-site"];
    return null;
  }

  function manquePourCreer(): [string, CibleChamp] | null {
    const site = manqueSite();
    if (site) return site;
    for (const [i, p] of paves.entries()) {
      const ou = paves.length > 1 ? ` (équipement ${i + 1})` : "";
      if (!p.libelle.trim()) return [`Renseigne le libellé du devis${ou}`, `pave-${p.cle}-libelle`];
      if (!p.nature) return [`Choisis la nature${ou}`, `pave-${p.cle}-nature`];
      if (!p.lignes.some((l) => l.designation.trim())) return [`Ajoute au moins une ligne d'article${ou}`, `pave-${p.cle}-ligne-0`];
    }
    if (remise.type && !remiseActive(remise)) return ["Saisis la valeur de la remise, ou décoche la remise", "devis-remise-valeur"];
    return null;
  }

  function pavesAEnregistrer(): PaveDevis[] {
    return paves.map((p) => ({
      equipementId: p.equipementId || null,
      equipementNom: p.equipementNom,
      localisation: p.localisation,
      libelle: p.libelle,
      nature: p.nature,
      lignes: p.lignes,
    }));
  }

  function finaliser() {
    setErreur(null);
    if (revision?.commande) {
      signaler("Ce devis est commandé ou annulé : il ne peut plus être révisé");
      return;
    }
    const manque = manquePourCreer();
    if (manque) {
      signaler(manque[0], manque[1]);
      return;
    }
    startTransition(async () => {
      if (revision && brouillonId) {
        const res = await reviserDevis(brouillonId, { paves: pavesAEnregistrer(), coutRevient, remise });
        if (!res.ok) {
          setErreur(res.erreur);
          return;
        }
        router.push(`/devis/${brouillonId}/statut`);
        router.refresh();
        return;
      }
      const res = await creerDevis({
        siteId,
        paves: pavesAEnregistrer(),
        coutRevient,
        remise,
        brouillonId: brouillonId ?? undefined,
        signalementBi: prefill?.signalementBi,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push("/devis");
      router.refresh();
    });
  }

  function enregistrerBrouillon() {
    setErreur(null);
    setBrouillonConfirme(false);
    const manque = manqueSite();
    if (manque) {
      signaler(manque[0], manque[1], { detail: "Le site suffit pour enregistrer un devis en cours." });
      return;
    }
    startEnregistrementBrouillon(async () => {
      const res = await enregistrerBrouillonDevis({
        id: brouillonId ?? undefined,
        siteId,
        paves: pavesAEnregistrer(),
        coutRevient,
        remise,
        signalementBi: prefill?.signalementBi,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setBrouillonId(res.id ?? null);
      setBrouillonConfirme(true);
    });
  }

  return (
    <div>
      {prefill?.signalementBi && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Pré-rempli depuis &quot;Devis à établir&quot;
          {prefill.equipementSignale && ` — signalé sur : ${prefill.equipementSignale}`}
        </p>
      )}
      {revision ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {revision.commande
            ? "Ce devis est commandé ou annulé : il ne peut plus être révisé."
            : `Révision du devis — à l'enregistrement il prend l'indice ${revision.indiceSuivant}, la version actuelle reste consultable sur sa fiche.`}
        </p>
      ) : (
        brouillon && (
          <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            Devis en cours repris — pas encore de numéro officiel tant qu&apos;il n&apos;est pas finalisé.
          </p>
        )
      )}

      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={ETIQUETTE}>Type de client *</label>
            <select id="devis-type" value={type} onChange={(e) => changerType(e.target.value as "" | "sous" | "hors")} className={CHAMP}>
              <option value="">— Choisir —</option>
              <option value="sous">Client sous contrat</option>
              <option value="hors">Client hors contrat</option>
            </select>
          </div>

          <div>
            <label className={ETIQUETTE}>Client *</label>
            <select id="devis-client" value={clientNom} onChange={(e) => changerClient(e.target.value)} disabled={!type} className={`${CHAMP} disabled:bg-slate-50`}>
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
            <select id="devis-site" value={siteId} onChange={(e) => changerSite(e.target.value)} disabled={!clientNom} className={`${CHAMP} disabled:bg-slate-50`}>
              <option value="">— Choisir un site —</option>
              {sitesDuClient.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.site || "(sans nom de site)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {paves.map((pave, i) => (
        <BlocPave
          key={pave.cle}
          pave={pave}
          numero={i + 1}
          nombrePaves={paves.length}
          siteId={siteId}
          equipements={equipements}
          equipementsPris={paves.filter((_, idx) => idx !== i).map((p) => p.equipementId)}
          natures={natures}
          coefficient={prixRevient.coefficientVente}
          tauxHoraire={prixRevient.tauxHoraire}
          onChange={(champs) => majPave(i, champs)}
          onRetirer={() => setPaves((prev) => prev.filter((_, idx) => idx !== i))}
        />
      ))}

      <BlocRemise remise={remise} montant={remiseEuros} onChange={setRemise} />

      <button
        type="button"
        onClick={ajouterPave}
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-brand-green/40 bg-white px-4 py-2 text-sm font-semibold text-brand-green-dark shadow-sm transition hover:bg-green-50"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Ajouter un équipement
      </button>

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
              <ChampLecture label="Synthèse (taux × heures)" valeur={eur(prixRevient.r2Total)} />
            </BlocCout>

            <BlocCout
              titre="R3 — Chantier"
              action={
                <button
                  type="button"
                  onClick={calculerChampsR3R4}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700"
                >
                  Calcul
                </button>
              }
            >
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
          {remiseActive(remise) && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">{libelleRemise(remise)}</span>
                <span className="font-medium text-slate-900">{eur(-remiseEuros)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total HT net</span>
                <span className="font-medium text-slate-900">{eur(totalNet)}</span>
              </div>
            </>
          )}
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
      {brouillonConfirme && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-brand-green-dark">
          Brouillon enregistré — retrouvable dans &quot;Devis en cours&quot;.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pb-8">
        <Link
          href={revision && brouillonId ? `/devis/${brouillonId}/statut` : "/devis"}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Annuler
        </Link>
        {!revision && (
          <button
            onClick={enregistrerBrouillon}
            disabled={enregistrementBrouillon}
            title="Enregistre même si des informations manquent, pour reprendre plus tard"
            className="rounded-xl border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:opacity-60"
          >
            {enregistrementBrouillon ? "Enregistrement..." : "Enregistrer"}
          </button>
        )}
        <button
          onClick={finaliser}
          disabled={pending}
          className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : revision ? `Enregistrer la révision ${revision.indiceSuivant}` : "Créer le devis"}
        </button>
      </div>
      {fenetre}
    </div>
  );
}

function BlocPave({
  pave,
  numero,
  nombrePaves,
  siteId,
  equipements,
  equipementsPris,
  natures,
  coefficient,
  tauxHoraire,
  onChange,
  onRetirer,
}: {
  pave: PaveSaisie;
  numero: number;
  nombrePaves: number;
  siteId: string;
  equipements: Equipement[];
  equipementsPris: string[];
  natures: Option[];
  coefficient: number;
  tauxHoraire: number;
  onChange: (champs: Partial<PaveSaisie>) => void;
  onRetirer: () => void;
}) {
  const { groupeFiltre, localisation, equipementId, lignes } = pave;
  const groupesExistants = [...new Set(equipements.map((e) => e.groupe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const equipementsDuGroupe = groupeFiltre ? equipements.filter((e) => e.groupe === groupeFiltre) : equipements;
  const localisationsSuggerees = [...new Set(equipementsDuGroupe.map((e) => e.localisation).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  // L'équipement choisi reste dans la liste, quels que soient les filtres.
  const equipementsFiltres = equipements.filter(
    (e) =>
      e.id === equipementId ||
      (!equipementsPris.includes(e.id) &&
        equipementsDuGroupe.includes(e) &&
        (!localisation.trim() || e.localisation.toLowerCase().includes(localisation.trim().toLowerCase()))),
  );
  const idListe = `localisations-pave-${pave.cle}`;
  const titreEquipement = equipements.find((e) => e.id === equipementId)?.libelle ?? pave.equipementNom;
  const sousTotal = lignes.reduce((s, l) => (l.designation.trim() ? s + (montantLigneDevis(l, coefficient, tauxHoraire) ?? 0) : s), 0);

  function changerEquipement(id: string) {
    const eq = equipements.find((e) => e.id === id);
    onChange({ equipementId: id, equipementNom: eq?.libelle ?? "", ...(eq ? { localisation: eq.localisation } : {}) });
  }

  function majLigne(i: number, champs: Partial<LigneDevis>) {
    onChange({ lignes: lignes.map((l, idx) => (idx === i ? { ...l, ...champs } : l)) });
  }

  return (
    <div className="mb-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      {nombrePaves > 1 && (
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-900">Équipement {numero}</h2>
          <button type="button" onClick={onRetirer} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-800">
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Retirer ce pavé
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={ETIQUETTE}>Groupe</label>
          <select
            value={groupeFiltre}
            onChange={(e) => onChange({ groupeFiltre: e.target.value })}
            disabled={!siteId || groupesExistants.length === 0}
            className={`${CHAMP} disabled:bg-slate-50`}
          >
            <option value="">— tous —</option>
            {groupesExistants.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIQUETTE}>Localisation</label>
          <input
            value={localisation}
            onChange={(e) => onChange({ localisation: e.target.value })}
            placeholder="Ex : Bureau 43"
            list={idListe}
            className={CHAMP}
          />
          {localisationsSuggerees.length > 0 && (
            <datalist id={idListe}>
              {localisationsSuggerees.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          )}
        </div>

        <div>
          <label className={ETIQUETTE}>Équipement concerné (facultatif)</label>
          <select
            value={equipementId}
            onChange={(e) => changerEquipement(e.target.value)}
            disabled={!siteId || equipementsFiltres.length === 0}
            className={`${CHAMP} disabled:bg-slate-50`}
          >
            <option value="">— aucun —</option>
            {equipementsFiltres.map((e) => (
              <option key={e.id} value={e.id}>
                {e.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={ETIQUETTE}>Libellé du devis *</label>
        <textarea id={`pave-${pave.cle}-libelle`} value={pave.libelle} onChange={(e) => onChange({ libelle: e.target.value })} rows={3} className={CHAMP} />
      </div>

      <div>
        <label className={ETIQUETTE}>Nature *</label>
        <select id={`pave-${pave.cle}-nature`} value={pave.nature} onChange={(e) => onChange({ nature: e.target.value })} className={CHAMP}>
          <option value="">— Choisir —</option>
          {natures.map((n) => (
            <option key={n.valeur} value={n.valeur}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Lignes d&apos;articles{titreEquipement ? ` — ${titreEquipement}` : ""}
          </h3>
          {lignes.length < MAX_LIGNES && (
            <button
              type="button"
              onClick={() => onChange({ lignes: [...lignes, ligneDevisVide()] })}
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
            <span>Déboursé fourniture €</span>
            <span>MO (h)</span>
            <span>Type</span>
            <span className="text-right">PU calculé</span>
            <span className="text-right">Montant</span>
            <span />
          </div>
          {lignes.map((l, i) => {
            const pu = prixUniteLigne(l, coefficient, tauxHoraire);
            const montant = montantLigneDevis(l, coefficient, tauxHoraire);
            return (
              <div key={i} className="grid grid-cols-[2fr_0.7fr_0.6fr_0.8fr_0.7fr_1.2fr_0.9fr_0.9fr_auto] items-center gap-1.5">
                <input
                  id={`pave-${pave.cle}-ligne-${i}`}
                  value={l.designation}
                  onChange={(e) => majLigne(i, { designation: e.target.value })}
                  placeholder="Désignation"
                  className={CHAMP_SM}
                />
                <select value={l.unite} onChange={(e) => majLigne(i, { unite: e.target.value })} className={CHAMP_SM}>
                  {UNITES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
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
                  onClick={() => onChange({ lignes: lignes.filter((_, idx) => idx !== i) })}
                  disabled={lignes.length === 1}
                  className="text-red-500 transition hover:text-red-700 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>

        {nombrePaves > 1 && (
          <p className="mt-3 text-right text-sm font-semibold text-slate-900">Sous-total HT : {eur(sousTotal)}</p>
        )}
      </div>
    </div>
  );
}

function BlocRemise({
  remise,
  montant,
  onChange,
}: {
  remise: RemiseDevis;
  montant: number;
  onChange: (remise: RemiseDevis) => void;
}) {
  const activee = remise.type !== "";
  return (
    <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <input
          type="checkbox"
          checked={activee}
          onChange={(e) => onChange(e.target.checked ? { type: "pct", valeur: "" } : remiseVide())}
          className="h-4 w-4 accent-brand-green"
        />
        Remise commerciale exceptionnelle
      </label>
      {activee && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["pct", "eur"] as TypeRemise[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ type: t, valeur: "" })}
                className={`rounded-md px-3 py-1 text-sm font-semibold transition ${
                  remise.type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "pct" ? "En %" : "En €"}
              </button>
            ))}
          </div>
          <div className="w-36">
            <label className={ETIQUETTE}>{remise.type === "pct" ? "Remise (%)" : "Remise (€ HT)"}</label>
            <input
              id="devis-remise-valeur"
              value={remise.valeur}
              onChange={(e) => onChange({ ...remise, valeur: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className={CHAMP_SM}
            />
          </div>
          <p className="pb-1.5 text-sm text-slate-600">
            Soit <span className="font-semibold text-slate-900">{eur(-montant)}</span> HT
          </p>
        </div>
      )}
    </div>
  );
}

function BlocCout({
  titre,
  action,
  children,
}: {
  titre: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titre}</p>
        {action}
      </div>
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
