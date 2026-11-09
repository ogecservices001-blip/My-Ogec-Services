"use client";

import { RelevesVisite } from "@/components/bi/releves-visite";
import { ChoixClientSite } from "@/components/choix-client-site";
import { dateFrVersIso, formaterDate } from "@/lib/format";

import { useChampManquant, type CibleChamp } from "@/components/champ-manquant";
import { useEffect, useMemo, useRef, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, Eye, X, Plus, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChampEnTeteField, TypeEquipementSelects } from "@/components/gmao/champs-famille";
import { SignaturePad, type SignaturePadHandle } from "@/components/bi/signature-pad";
import { NATURE_MULTIPLE, type PaveDevis } from "@/lib/devis/paves";
import type { TypeEquipement, ReferenceHoraire, ChampsEnTeteEquipement } from "@/lib/gmao/types";
import {
  Poles,
  labelPole,
  avecAffaire,
  avecPeriode,
  avecEquipementObligatoire,
  avecGroupesEntretien,
  avecEquipementOptionnel,
  avecEquipementLibre,
  avecNouvelEquipement,
  avecTempsLibre,
  avecFournitureMateriel,
  CHAMPS_MATERIEL_EXCLUS_BI,
  CHAMPS_MATERIEL_FACULTATIFS_BI, SANS_GROUPE, groupeEntretien } from "@/lib/bi/constants";
import { today, tempsStandard, multiplierDuree, periodeOuvree, ETATS_EQUIPEMENT } from "@/lib/bi/format";
import { chargerEquipementsDuSite, chargerDevisDuSite, chargerModeleBI, chargerInfosNouvelEquipement, enregistrerBI, type EquipementDuSite, type DevisDuSite, type DevisARealiser, type ModeleBI, type PhotoInput, type PrestaInput, type DepannageEnCours, type InterventionSupplementaireInput, type BrouillonBI, proposerVisiteBI } from "./actions";

type SiteOption = {
  id: string;
  nom: string;
  site: string;
  hors_contrat: boolean;
  adresse: string;
  code_postal: string;
  commune: string;
  interlocuteur_site: string;
  tel_fixe_interlocuteur_site: string;
  portable_interlocuteur_site: string;
  courriel_interlocuteur_site: string;
};

const ACCENT = "bg-violet-600";

const COULEURS_POLES: Record<string, string> = {
  [Poles.depannage]: "#E53935",
  [Poles.remplacementIdentique]: "#1E88E5",
  [Poles.installationNeuve]: "#43A047",
  [Poles.reparationEquipement]: "#FB8C00",
  [Poles.reparationDiverse]: "#8D6E63",
  [Poles.entretienSousContrat]: "#00897B",
  [Poles.entretienHorsContrat]: "#8E24AA",
  [Poles.miseADisposition]: "#546E7A",
  [Poles.livraisonMateriel]: "#3949AB",
};

const TOTAL_ETAPES = 4;

/// Pôles avec compte rendu pré-rempli (étape 2/3) et résumé avant
/// signature (étape 3/3) — Entretien sous contrat a son propre
/// mécanisme dédié (une ligne par groupe coché, voir plus bas).
const POLES_AVEC_RESUME = new Set<string>([
  Poles.remplacementIdentique,
  Poles.reparationEquipement,
  Poles.reparationDiverse,
  Poles.installationNeuve,
  Poles.entretienHorsContrat,
  Poles.miseADisposition,
  Poles.livraisonMateriel,
]);

function champsPertinents(type: TypeEquipement | null): TypeEquipement["champs_en_tete_supplementaires"] {
  if (!type) return [];
  return type.champs_en_tete_supplementaires.filter((c) => !CHAMPS_MATERIEL_EXCLUS_BI.has(c.cle));
}

function champTexte(champs: ChampsEnTeteEquipement, cle: string): string {
  const v = champs[cle];
  return typeof v === "string" ? v : "";
}

/// Pages d'un devis à plusieurs natures, une par pavé ; null sinon.
function pagesDuDevis(d: { nature: string; paves: unknown }): PaveDevis[] | null {
  if (d.nature !== NATURE_MULTIPLE) return null;
  const paves = (d.paves as PaveDevis[] | null) ?? [];
  return paves.length > 0 ? paves : null;
}

function etatsDepuisReponses(devisAEtablir: boolean | null, horsService: boolean | null): string[] {
  const etats: string[] = [];
  if (devisAEtablir) etats.push("devis_a_etablir");
  if (horsService === true) etats.push("hors_service");
  if (horsService === false) etats.push("operationnel");
  return etats;
}

export function BiWizard({
  sites,
  techniciensDisponibles,
  typesEquipement,
  references,
  nomUtilisateur,
  depannagesEnCours,
  devisARealiser,
  brouillon,
}: {
  sites: SiteOption[];
  techniciensDisponibles: string[];
  typesEquipement: TypeEquipement[];
  references: ReferenceHoraire[];
  nomUtilisateur: string;
  depannagesEnCours: DepannageEnCours[];
  devisARealiser: DevisARealiser[];
  brouillon: BrouillonBI | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Boutons contextuels (carte devis dans /prestations, carte ticket
  // dans /depannages) et liens de la sidebar : pré-remplissage calculé
  // dès le premier rendu, pas dans un effet après coup — /bi/nouveau
  // est la même route pour tous les BI, donc la page (Server Component)
  // met pole/devisId/depannageId en `key` du wizard pour forcer un vrai
  // remontage (et donc un nouveau calcul ici) quand on passe d'un
  // contexte à l'autre, plutôt que de réutiliser une instance déjà
  // montée dont les useState ne se réinitialiseraient pas tout seuls.
  function calculerEtatInitial() {
    const poleParam = searchParams.get("pole") ?? "";
    const devisIdParam = searchParams.get("devisId");
    const depannageIdParam = searchParams.get("depannageId");

    if (brouillon) {
      const s = sites.find((site) => site.id === brouillon.site_id);
      return {
        etape: 1,
        pole: brouillon.pole,
        devisId: brouillon.devis_id ?? "",
        depannageId: brouillon.depannage_id,
        clientNom: s?.nom ?? "",
        siteId: brouillon.site_id,
        equipementId: brouillon.equipement_id ?? "",
        compteRendu: brouillon.compte_rendu,
      };
    }
    if (devisIdParam) {
      const d = devisARealiser.find((x) => x.id === devisIdParam);
      if (d) {
        const pages = pagesDuDevis(d);
        return {
          etape: 1,
          pole: pages ? pages[0].nature : d.nature,
          devisId: d.id,
          depannageId: null as string | null,
          clientNom: d.client_nom,
          siteId: d.site_id,
          equipementId: pages ? (pages[0].equipementId ?? "") : (d.equipement_id ?? ""),
          compteRendu: "",
        };
      }
    }
    if (depannageIdParam) {
      const d = depannagesEnCours.find((x) => x.id === depannageIdParam);
      if (d) {
        const s = sites.find((site) => site.id === d.site_id);
        return {
          etape: 1,
          pole: Poles.depannage,
          devisId: "",
          depannageId: d.id,
          clientNom: s?.nom ?? "",
          siteId: s?.id ?? "",
          equipementId: d.equipement_id ?? "",
          compteRendu: "",
        };
      }
    }
    if (poleParam) {
      return { etape: 1, pole: poleParam, devisId: "", depannageId: null as string | null, clientNom: "", siteId: "", equipementId: "", compteRendu: "" };
    }
    return { etape: 1, pole: "", devisId: "", depannageId: null as string | null, clientNom: "", siteId: "", equipementId: "", compteRendu: "" };
  }
  const etatInitial = calculerEtatInitial();
  // Première étape réellement affichée — si on arrive pré-rempli
  // (Dépannage, ticket, carte devis), l'étape Pôle est sautée et ne
  // doit jamais réapparaître via "Précédent" : revenir en arrière
  // depuis cette toute première étape sort de l'assistant au lieu de
  // révéler une étape jamais montrée.
  const [etapeDepart] = useState(etatInitial.etape);

  const [etape, setEtape] = useState(etatInitial.etape);
  const [pole, setPole] = useState(etatInitial.pole);
  const [enregistrement, startEnregistrement] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  // Brouillon repris (voir /prestations "Reprendre le BI") : les
  // sauvegardes suivantes mettent à jour cette même ligne, jamais une
  // nouvelle — évite exactement le bug "3 clics = 3 BI différents".
  const [brouillonId, setBrouillonId] = useState<string | null>(brouillon?.id ?? null);
  const [brouillonConfirme, setBrouillonConfirme] = useState(false);

  const [depannageId, setDepannageId] = useState<string | null>(etatInitial.depannageId);

  // ---------- Étape 1 : Client ----------
  const [clientNom, setClientNom] = useState(etatInitial.clientNom);
  const [siteId, setSiteId] = useState(etatInitial.siteId);
  const [devisId, setDevisId] = useState(etatInitial.devisId);
  const [devisDuSite, setDevisDuSite] = useState<DevisDuSite[]>([]);
  const [equipementsSite, setEquipementsSite] = useState<EquipementDuSite[]>([]);
  const [equipementId, setEquipementId] = useState(etatInitial.equipementId);
  const [chargementSite, startChargementSite] = useTransition();

  const [typeActifId, setTypeActifId] = useState(brouillon?.materiel_type_equipement_id ?? "");
  const [materielChamps, setMaterielChamps] = useState<Record<string, string>>(
    brouillon?.materiel_champs_en_tete ?? {},
  );
  // Type Equipement 2/3 ne sont jamais des listes (ChampListeLigne[]) côté
  // BI — seul le formulaire GMAO complet gère les champs_listes — d'où ce
  // recast pour réutiliser TypeEquipementSelects sans dupliquer son état.
  const setMaterielChampsTypeEquipement = setMaterielChamps as unknown as Dispatch<SetStateAction<ChampsEnTeteEquipement>>;
  const brouillonNouvelEquipement = brouillon && !brouillon.equipement_id ? brouillon : null;
  const [installationNom, setInstallationNom] = useState(brouillonNouvelEquipement?.equipement_nom ?? "");
  const [installationLocalisation, setInstallationLocalisation] = useState(
    brouillonNouvelEquipement?.equipement_localisation ?? "",
  );
  const [installationGroupe, setInstallationGroupe] = useState(brouillonNouvelEquipement?.equipement_groupe ?? "");
  const [equipementLibre, setEquipementLibre] = useState(brouillonNouvelEquipement?.equipement_nom ?? "");
  const [groupesSelectionnes, setGroupesSelectionnes] = useState<Set<string>>(
    new Set(brouillon?.entretien_groupes ?? []),
  );
  const [nonDesservisIds, setNonDesservisIds] = useState<Set<string>>(new Set());
  const [motifsNonDesservi, setMotifsNonDesservi] = useState<Record<string, string>>({});

  // "Dépannage — Clients sous/hors contrat" (sidebar) : pré-filtre la
  // liste de clients proposée, pour que le technicien n'ait pas à
  // chercher parmi tous les clients confondus.
  const horsContratParam = searchParams.get("horsContrat");
  // Entretien sous contrat : uniquement les clients sous contrat.
  const sitesFiltres = useMemo(() => {
    if (pole === Poles.entretienSousContrat) return sites.filter((s) => !s.hors_contrat);
    return horsContratParam !== null ? sites.filter((s) => s.hors_contrat === (horsContratParam === "1")) : sites;
  }, [sites, horsContratParam, pole]);
  const site = sites.find((s) => s.id === siteId) ?? null;
  const typeActif = typesEquipement.find((t) => t.id === typeActifId) ?? null;
  const equipement = equipementsSite.find((e) => e.id === equipementId) ?? null;

  useEffect(() => {
    if (!siteId) {
      setEquipementsSite([]);
      setDevisDuSite([]);
      return;
    }
    startChargementSite(async () => {
      const [eqs, dvs] = await Promise.all([
        chargerEquipementsDuSite(siteId),
        avecAffaire(pole) ? chargerDevisDuSite(siteId, pole) : Promise.resolve([]),
      ]);
      setEquipementsSite(eqs);
      setDevisDuSite(dvs);
    });
    // Redéclenché aussi si le technicien revient à l'étape 0 pour
    // changer de pôle sans changer de client — la liste de devis est
    // filtrée par nature (voir chargerDevisDuSite) et deviendrait
    // sinon obsolète.
  }, [siteId, pole]);

  const premierSiteEffectRef = useRef(true);
  useEffect(() => {
    const premier = premierSiteEffectRef.current;
    premierSiteEffectRef.current = false;
    if (!site) return;
    // Un brouillon repris a déjà ses propres coordonnées saisies (ou
    // volontairement laissées vides) — ne pas les écraser avec celles
    // du site au premier rendu.
    if (premier && brouillon) return;
    setSignataire(site.interlocuteur_site);
    setSignataireTelPortable(site.portable_interlocuteur_site);
    setSignataireTelFixe(site.tel_fixe_interlocuteur_site);
    setEmail(site.courriel_interlocuteur_site);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pré-remplissage ponctuel au choix du site, pas une synchro continue
  }, [siteId]);

  useEffect(() => {
    if (!avecNouvelEquipement(pole) || !devisId) return;
    chargerInfosNouvelEquipement(devisId).then((infos) => {
      if (!infos) return;
      if (infos.nom && !installationNom.trim()) setInstallationNom(infos.nom);
      if (infos.localisation && !installationLocalisation.trim()) setInstallationLocalisation(infos.localisation);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pré-remplissage ponctuel au choix du devis, pas une synchro continue
  }, [devisId, pole]);

  function annulerDepannage() {
    setDepannageId(null);
  }

  const groupesDisponibles = useMemo(
    () =>
      [...new Set(equipementsSite.map((e) => groupeEntretien(e.groupe)))].sort((a, b) =>
        a === SANS_GROUPE ? 1 : b === SANS_GROUPE ? -1 : a.localeCompare(b, "fr"),
      ),
    [equipementsSite],
  );
  const equipementsGroupesSelectionnes = equipementsSite.filter((e) => groupesSelectionnes.has(groupeEntretien(e.groupe)));

  function toggleGroupe(groupe: string, coche: boolean) {
    setGroupesSelectionnes((prev) => {
      const next = new Set(prev);
      if (coche) next.add(groupe);
      else next.delete(groupe);
      return next;
    });
    if (!coche) {
      const idsDuGroupe = new Set(equipementsSite.filter((e) => groupeEntretien(e.groupe) === groupe).map((e) => e.id));
      setNonDesservisIds((prev) => new Set([...prev].filter((id) => !idsDuGroupe.has(id))));
    }
  }

  function toggleNonDesservi(eq: EquipementDuSite) {
    setNonDesservisIds((prev) => {
      const next = new Set(prev);
      if (next.has(eq.id)) next.delete(eq.id);
      else next.add(eq.id);
      return next;
    });
  }

  // Compte rendu auto-généré pour Entretien sous contrat, une ligne par
  // groupe coché — ne réécrit jamais un texte déjà modifié à la main.
  const texteAutoEntretienRef = useRef("");
  useEffect(() => {
    if (!avecGroupesEntretien(pole)) return;
    const actuel = compteRenduRef.current.trim();
    if (actuel && actuel !== texteAutoEntretienRef.current.trim()) return;
    const lignes: string[] = [];
    for (const groupe of groupesSelectionnes) {
      const eqs = equipementsSite.filter((e) => groupeEntretien(e.groupe) === groupe);
      if (eqs.length === 0) continue;
      const n = eqs.length;
      lignes.push(`Entretien ${groupe} : ${n} équipement${n > 1 ? "s" : ""}.`);
    }
    const texte = lignes.join("\n");
    texteAutoEntretienRef.current = texte;
    setCompteRendu(texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupesSelectionnes, equipementsSite]);

  // Compte rendu auto-généré pour les pôles à résumé (nature + ce qui
  // est déjà connu de l'étape 1) — ne réécrit jamais un texte déjà
  // modifié à la main, même principe que l'auto-texte Entretien sous
  // contrat ci-dessus.
  const texteAutoRef = useRef("");
  useEffect(() => {
    if (!POLES_AVEC_RESUME.has(pole)) return;
    const actuel = compteRenduRef.current.trim();
    if (actuel && actuel !== texteAutoRef.current.trim()) return;

    let texte = labelPole(pole);
    if (avecNouvelEquipement(pole)) {
      const lignes = [
        typeActif?.nom,
        installationLocalisation && `Localisation : ${installationLocalisation}`,
        installationGroupe && `Groupe : ${installationGroupe}`,
        champTexte(materielChamps, "typeEquipement2") && `Type Equipement 2 : ${champTexte(materielChamps, "typeEquipement2")}`,
        champTexte(materielChamps, "typeEquipement3") &&
          `Type Equipement 3 (puissance) : ${champTexte(materielChamps, "typeEquipement3")}`,
      ].filter((v): v is string => Boolean(v));
      texte = [labelPole(pole), ...lignes].join("\n");
    } else {
      const nom = equipement ? equipement.nom : avecEquipementLibre(pole) ? equipementLibre.trim() : "";
      const localisation = equipement?.localisation ?? "";
      if (nom) texte = [labelPole(pole), [nom, localisation].filter(Boolean).join(" – ")].join(" — ");
    }
    texteAutoRef.current = texte;
    setCompteRendu(texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pole,
    equipementId,
    equipementsSite,
    equipementLibre,
    typeActifId,
    installationLocalisation,
    installationGroupe,
    materielChamps,
  ]);

  // ---------- Étape 2 : Compte rendu + photos ----------
  const [compteRendu, setCompteRendu] = useState(etatInitial.compteRendu);
  const compteRenduRef = useRef("");
  compteRenduRef.current = compteRendu;
  const [obsTech, setObsTech] = useState(brouillon?.obs_tech ?? "");
  const [obsClient, setObsClient] = useState(brouillon?.obs_client ?? "");
  const [photos, setPhotos] = useState<(PhotoInput & { preview: string; enCours: boolean })[]>(
    brouillon?.photos.map((p) => ({ ...p, enCours: false })) ?? [],
  );
  const [fourniture, setFourniture] = useState<PrestaInput[]>(
    brouillon && brouillon.prestas.length > 0 ? brouillon.prestas : [{ designation: "", quantite: "" }],
  );

  // Pôle Dépannage uniquement : remplace "Observation technicien" (texte
  // libre, par visite) par un état par équipement. Coché seul ou avec
  // "Devis à établir", "Équipement opérationnel" vide le tableau au
  // moment d'enregistrer plutôt que d'y ajouter une valeur.
  // État de l'équipement : répondu via 2 popups au clic sur "Suivant"
  // (jamais coché à la main) — un technicien livré à lui-même ne
  // remplit pas des cases libres. `null` = pas encore répondu.
  const [devisAEtablir, setDevisAEtablir] = useState<boolean | null>(null);
  const [etatHorsService, setEtatHorsService] = useState<boolean | null>(null);
  const [popupDevis, setPopupDevis] = useState(false);
  const [popupEtat, setPopupEtat] = useState(false);
  const [apresQuestions, setApresQuestions] = useState<"suivant" | "autre">("suivant");
  const etatEquipement = etatsDepuisReponses(devisAEtablir, etatHorsService);
  function etatEquipementAEnregistrer(etats: string[]): string[] {
    return etats.includes("operationnel") ? [] : etats;
  }

  // Pôle Dépannage uniquement : un technicien touche souvent plusieurs
  // équipements dans la même visite. Chaque "Autre équipement" referme
  // l'intervention en cours (équipement/compte rendu/fourniture) ici et
  // ramène à l'étape équipement pour la suivante ; obs/photos restent
  // communes à la visite entière.
  const [interventionsSupplementaires, setInterventionsSupplementaires] = useState<InterventionSupplementaireInput[]>(
    brouillon?.interventions_supplementaires ?? [],
  );

  // Devis à plusieurs équipements : même mécanisme que le Dépannage, un
  // seul BI, le prochain équipement du devis étant proposé d'office.
  const devisCourant = devisDuSite.find((d) => d.id === devisId) ?? null;
  // Devis à plusieurs natures : une page par pavé, chacune avec son type.
  const pagesDevis = devisCourant ? pagesDuDevis(devisCourant) : null;
  const modePages = pagesDevis !== null;
  const indexPage = interventionsSupplementaires.length;
  const pageSuivante = pagesDevis?.[indexPage + 1] ?? null;
  const equipementsDuDevis = devisCourant && !modePages
    ? [devisCourant.equipement_id, ...devisCourant.equipements_supplementaires].filter((id): id is string => Boolean(id))
    : [];
  // Tous les équipements du devis doivent être faits avant de continuer,
  // hors équipement supprimé du parc depuis (il bloquerait à vie). Pas de
  // liste pour une Installation neuve : les équipements n'existent pas encore.
  const equipementsRestants = avecNouvelEquipement(pole)
    ? []
    : equipementsDuDevis.filter(
        (id) =>
          id !== equipementId &&
          equipementsSite.some((e) => e.id === id) &&
          !interventionsSupplementaires.some((i) => i.equipement_id === id),
      );
  const resteAFaire = pole !== Poles.depannage && equipementsRestants.length > 0;
  const plusieursEquipements =
    pole === Poles.depannage ||
    avecNouvelEquipement(pole) ||
    equipementsDuDevis.length > 1 ||
    interventionsSupplementaires.length > 0;
  const autreEquipementPossible = !modePages && (pole === Poles.depannage || avecNouvelEquipement(pole) || resteAFaire);

  function pageActuelle(): InterventionSupplementaireInput {
    const neuve = avecNouvelEquipement(pole);
    return {
      pole,
      equipement_id: neuve ? null : (equipement?.id ?? null),
      equipement_nom: neuve ? installationNom.trim() || (typeActif?.nom ?? "") : equipement ? equipement.nom : equipementLibre.trim(),
      equipement_groupe: neuve ? installationGroupe.trim() : (equipement?.groupe ?? ""),
      equipement_localisation: neuve ? installationLocalisation.trim() : (equipement?.localisation ?? ""),
      compte_rendu: compteRendu.trim(),
      prestas: [],
      etat_equipement: [],
      materiel_type_equipement_id: typeActif?.id ?? null,
      materiel_champs_en_tete: materielChamps,
      modele_champs: modeleChamps,
      checklist_values: checklistValues,
    };
  }

  function passerPageSuivante() {
    if (!pageSuivante) return;
    setInterventionsSupplementaires((prev) => [...prev, pageActuelle()]);
    const neuve = avecNouvelEquipement(pageSuivante.nature);
    setPole(pageSuivante.nature);
    setEquipementId(pageSuivante.equipementId ?? "");
    setEquipementLibre(!pageSuivante.equipementId && !neuve ? pageSuivante.equipementNom : "");
    setTypeActifId("");
    setMaterielChamps({});
    setInstallationNom(neuve ? pageSuivante.equipementNom : "");
    setInstallationLocalisation(neuve ? pageSuivante.localisation : "");
    setInstallationGroupe("");
    setCompteRendu("");
    setModeleChamps({});
    setChecklistValues({});
    setEtape(1);
  }

  function retour() {
    if (etape > etapeDepart) setEtape(etape - 1);
    else if (modePages && indexPage > 0) {
      setErreur("Les pages précédentes sont déjà validées : le bureau pourra les corriger à la vérification.");
    } else router.push("/");
  }

  function ajouterAutreEquipement(etats: string[]) {
    const nom = avecNouvelEquipement(pole)
      ? installationNom.trim() || (typeActif?.nom ?? "")
      : equipement
        ? equipement.nom
        : equipementLibre.trim();
    if (!nom) return;
    setInterventionsSupplementaires((prev) => [
      ...prev,
      {
        equipement_id: equipement?.id ?? null,
        equipement_nom: nom,
        equipement_groupe: avecNouvelEquipement(pole) ? installationGroupe.trim() : (equipement?.groupe ?? ""),
        equipement_localisation: avecNouvelEquipement(pole) ? installationLocalisation.trim() : (equipement?.localisation ?? ""),
        compte_rendu: compteRendu.trim(),
        prestas: fourniture.filter((p) => p.designation.trim()),
        etat_equipement: etatEquipementAEnregistrer(etats),
        ...(pole === Poles.remplacementIdentique ? { materiel_champs_en_tete: materielChamps } : {}),
        ...(avecNouvelEquipement(pole)
          ? { materiel_champs_en_tete: materielChamps, materiel_type_equipement_id: typeActif?.id ?? null }
          : {}),
      },
    ]);
    if (pole !== Poles.depannage) {
      setTypeActifId("");
      setMaterielChamps({});
    }
    if (avecNouvelEquipement(pole)) {
      setInstallationNom("");
      setInstallationLocalisation("");
      setInstallationGroupe("");
    }
    setEquipementId(pole === Poles.depannage ? "" : (equipementsRestants[0] ?? ""));
    setEquipementLibre("");
    setCompteRendu("");
    setFourniture([{ designation: "", quantite: "" }]);
    setDevisAEtablir(null);
    setEtatHorsService(null);
    setEtape(1);
  }

  function retirerAutreEquipement(index: number) {
    setInterventionsSupplementaires((prev) => prev.filter((_, i) => i !== index));
  }

  // Modèle du pôle (voir Référentiel BI) — champs guidés + checklist,
  // consultés en direct à chaque changement de pôle, jamais mis en
  // cache au-delà de cette session de l'assistant.
  const [modele, setModele] = useState<ModeleBI | null>(null);
  const [modeleChamps, setModeleChamps] = useState<Record<string, string>>(brouillon?.modele_champs ?? {});
  const [checklistValues, setChecklistValues] = useState<Record<string, boolean | string>>(
    brouillon?.checklist_values ?? {},
  );

  const premierModeleEffectRef = useRef(true);
  useEffect(() => {
    const premier = premierModeleEffectRef.current;
    premierModeleEffectRef.current = false;
    if (!pole) {
      setModele(null);
      return;
    }
    let annule = false;
    chargerModeleBI(pole).then((m) => {
      if (annule) return;
      setModele(m);
      // Un brouillon repris a déjà ses champs guidés/checklist restaurés
      // (voir useState plus haut) — ne pas les effacer au premier rendu.
      if (!(premier && brouillon)) {
        setModeleChamps({});
        setChecklistValues({});
      }
      if (m?.texte_type && !compteRenduRef.current.trim()) setCompteRendu(m.texte_type);
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `brouillon` ne change jamais après montage (voir `key` du wizard)
  }, [pole]);

  async function redimensionner(fichier: File, maxDim = 1600): Promise<Blob> {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.round(bitmap.width * echelle);
    const hauteur = Math.round(bitmap.height * echelle);
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? fichier), "image/jpeg", 0.85));
  }

  async function ajouterPhoto(fichier: File) {
    if (photos.length >= 4) return;
    const preview = URL.createObjectURL(fichier);
    const index = photos.length;
    setPhotos((prev) => [...prev, { type: "defaut", storage_path: "", preview, enCours: true, horodatage: today() }]);
    try {
      const blob = await redimensionner(fichier);
      const chemin = `${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("bi-photos").upload(chemin, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, storage_path: chemin, enCours: false } : p)));
    } catch {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // ---------- Étape 3 : Techniciens + Dates + Signatures ----------
  const [techniciens, setTechniciens] = useState<string[]>(
    brouillon && brouillon.techniciens.length > 0 ? brouillon.techniciens : nomUtilisateur ? [nomUtilisateur] : [],
  );
  const [dateDebut, setDateDebut] = useState(brouillon?.date_debut || today());
  const [dateFin, setDateFin] = useState(brouillon?.date_fin || today());
  const [dateIntervention, setDateIntervention] = useState(brouillon?.date_intervention || today());
  const [tempsPasse, setTempsPasse] = useState(brouillon?.temps_passe ?? "");
  // Si un temps était déjà saisi sur le brouillon, ne pas le laisser
  // recalculer/écraser par l'effet de temps standard ci-dessous.
  const [tempsManuel, setTempsManuel] = useState(Boolean(brouillon?.temps_passe));
  const [signataire, setSignataire] = useState(brouillon?.signataire ?? "");
  const [signataireTelPortable, setSignataireTelPortable] = useState(brouillon?.signataire_tel_portable ?? "");
  const [signataireTelFixe, setSignataireTelFixe] = useState(brouillon?.signataire_tel_fixe ?? "");
  const [email, setEmail] = useState(brouillon?.email ?? "");
  const sigTechRef = useRef<SignaturePadHandle>(null);
  const sigClientRef = useRef<SignaturePadHandle>(null);
  const [sigTechVide, setSigTechVide] = useState(true);
  const [sigClientVide, setSigClientVide] = useState(true);
  const [nombreDeplacements, setNombreDeplacements] = useState<number | "">(brouillon?.nombre_deplacements ?? "");
  const [alerteHeures, setAlerteHeures] = useState(false);
  const [alerteDeplacements, setAlerteDeplacements] = useState(false);
  const [alerteTechnicien, setAlerteTechnicien] = useState(false);
  const [alerteSignature, setAlerteSignature] = useState(false);
  const [champEnEvidence, setChampEnEvidence] = useState<string | null>(null);
  const [apercuEnCours, setApercuEnCours] = useState(false);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const tempsPasseRef = useRef<HTMLInputElement>(null);
  const nombreDeplacementsRef = useRef<HTMLInputElement>(null);
  const techniciensRef = useRef<HTMLDivElement>(null);
  const signataireRef = useRef<HTMLInputElement>(null);
  const sigTechZoneRef = useRef<HTMLDivElement>(null);
  const sigClientZoneRef = useRef<HTMLDivElement>(null);

  function pointerVers(ref: { current: HTMLElement | null }, cle: string) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setChampEnEvidence(cle);
    setTimeout(() => setChampEnEvidence((v) => (v === cle ? null : v)), 2500);
  }

  useEffect(() => {
    if (tempsManuel) return;
    const base = avecTempsLibre(pole)
      ? ""
      : avecPeriode(pole)
        ? periodeOuvree(dateDebut, dateFin).temps
        : tempsStandard(dateIntervention);
    setTempsPasse(base ? multiplierDuree(base, techniciens.length) : "");
  }, [pole, dateIntervention, dateDebut, dateFin, techniciens.length, tempsManuel]);

  // Période : un déplacement par jour ouvré (lundi au vendredi), tant que le
  // technicien n'a pas corrigé lui-même.
  const [deplacementsManuel, setDeplacementsManuel] = useState(false);
  useEffect(() => {
    if (!avecPeriode(pole) || deplacementsManuel) return;
    const { jours } = periodeOuvree(dateDebut, dateFin);
    if (jours > 0) setNombreDeplacements(jours);
  }, [pole, dateDebut, dateFin, deplacementsManuel]);

  // Calcul automatique (journée type) à faire confirmer : certains clients ne
  // reçoivent que le matin, ce n'est pas toujours une journée complète.
  const [popupHeures, setPopupHeures] = useState(false);
  const heuresConfirmeesRef = useRef(false);

  function ajouterTechnicien(nom: string) {
    if (!nom || techniciens.includes(nom)) return;
    setTechniciens((prev) => [...prev, nom]);
  }
  function retirerTechnicien(nom: string) {
    setTechniciens((prev) => prev.filter((t) => t !== nom));
  }

  // ==================== Validation des étapes ====================

  const materielComplet = useMemo(() => {
    if (!typeActif) return false;
    return champsPertinents(typeActif)
      .filter((c) => !CHAMPS_MATERIEL_FACULTATIFS_BI.has(c.cle))
      .every((c) => (materielChamps[c.cle] ?? "").trim() !== "");
  }, [typeActif, materielChamps]);

  const { signaler, fenetre: fenetreChampManquant } = useChampManquant();

  // Visite d'entretien saisie par le technicien (pré-remplie, modifiable).
  const [visiteNumero, setVisiteNumero] = useState(brouillon?.visite_numero ? String(brouillon.visite_numero) : "");
  const [visiteTotal, setVisiteTotal] = useState(brouillon?.visite_total ? String(brouillon.visite_total) : "");
  const [visiteAnnee, setVisiteAnnee] = useState(brouillon?.visite_annee ? String(brouillon.visite_annee) : "");
  const visiteModifiee = useRef(Boolean(brouillon?.visite_numero));
  const clePropositionVisite = [siteId, [...groupesSelectionnes].sort().join("|"), [...nonDesservisIds].sort().join("|"), dateDebut, dateFin].join("#");
  useEffect(() => {
    if (pole !== Poles.entretienSousContrat || !siteId || groupesSelectionnes.size === 0 || visiteModifiee.current) return;
    let annule = false;
    proposerVisiteBI({
      siteId,
      groupes: [...groupesSelectionnes],
      nonDesservis: equipementsGroupesSelectionnes.filter((e) => nonDesservisIds.has(e.id)).map((e) => e.nom),
      dateDebut,
      dateFin,
    }).then((v) => {
      if (annule || visiteModifiee.current) return;
      setVisiteNumero(String(v.numero));
      setVisiteTotal(String(v.total));
      setVisiteAnnee(String(v.annee));
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcul seulement quand site, groupes ou dates changent
  }, [pole, clePropositionVisite]);

  function manqueVisite(): [string, CibleChamp] | null {
    if (pole !== Poles.entretienSousContrat) return null;
    const total = Number(visiteTotal);
    if (!Number.isInteger(total) || total < 1 || total > 12) return ["Indique le nombre de visites par an (1 à 12)", "wizard-visite-total"];
    const numero = Number(visiteNumero);
    if (!Number.isInteger(numero) || numero < 1 || numero > total) return [`Indique le n° de la visite (1 à ${total})`, "wizard-visite-numero"];
    const annee = Number(visiteAnnee);
    if (!Number.isInteger(annee) || annee < 2020 || annee > 2100) return ["Indique l'année du contrat (ex : 2026)", "wizard-visite-annee"];
    return null;
  }

  function manqueEtapeClient(): [string, CibleChamp] | null {
    if (!clientNom) return ["Choisis le client", "wizard-client"];
    if (!siteId) return ["Choisis le site", "wizard-site"];
    if (avecAffaire(pole) && !devisId) return ["Choisis l'affaire (devis commandé)", "wizard-devis"];
    if (avecEquipementObligatoire(pole) && !equipementId) return ["Choisis l'équipement", "wizard-equipement"];
    if (avecNouvelEquipement(pole)) {
      if (!typeActif) return ["Choisis la famille d'équipement", "wizard-famille"];
      if (!installationLocalisation.trim()) return ["Renseigne la localisation", "wizard-localisation"];
    }
    if ((pole === Poles.remplacementIdentique || avecNouvelEquipement(pole)) && !materielComplet) {
      if (!typeActif) return ["Choisis le type du nouveau matériel", "wizard-materiel"];
      const manquant = champsPertinents(typeActif)
        .filter((c) => !CHAMPS_MATERIEL_FACULTATIFS_BI.has(c.cle))
        .find((c) => (materielChamps[c.cle] ?? "").trim() === "");
      return [`Complète les caractéristiques du matériel${manquant ? ` : ${manquant.label}` : ""}`, "wizard-materiel"];
    }
    if (avecGroupesEntretien(pole)) {
      if (groupesSelectionnes.size === 0) return ["Coche au moins un groupe à entretenir", "wizard-groupes"];
      for (const id of nonDesservisIds) {
        if (!(motifsNonDesservi[id] ?? "").trim()) return ["Indique le motif de non-entretien", `wizard-motif-${id}`];
      }
    }
    return manqueVisite();
  }

  const peutAvancerEtapeClient = useMemo(() => {
    if (!siteId) return false;
    if (avecAffaire(pole) && !devisId) return false;
    if (avecEquipementObligatoire(pole) && !equipementId) return false;
    if (pole === Poles.remplacementIdentique && !materielComplet) return false;
    if (avecNouvelEquipement(pole)) {
      if (!installationLocalisation.trim()) return false;
      if (!materielComplet) return false;
    }
    if (avecGroupesEntretien(pole)) {
      if (groupesSelectionnes.size === 0) return false;
      for (const id of nonDesservisIds) {
        if (!(motifsNonDesservi[id] ?? "").trim()) return false;
      }
    }
    return true;
  }, [siteId, pole, devisId, equipementId, materielComplet, installationLocalisation, groupesSelectionnes, nonDesservisIds, motifsNonDesservi]);

  const photosEnCours = photos.some((p) => p.enCours);

  // Résumé affiché juste avant signature (étape 3) : le client doit
  // voir ce qu'il signe, surtout quand plusieurs équipements ont été
  // traités dans la même visite.
  const recapInterventions =
    pole === Poles.depannage || interventionsSupplementaires.length > 0
      ? [
          ...interventionsSupplementaires,
          {
            pole,
            equipement_nom: avecNouvelEquipement(pole)
              ? installationNom.trim() || (typeActif?.nom ?? "")
              : equipement
                ? equipement.nom
                : equipementLibre.trim(),
            compte_rendu: compteRendu.trim(),
            prestas: fourniture.filter((p) => p.designation.trim()),
            etat_equipement: etatEquipementAEnregistrer(etatEquipement),
          },
        ]
      : [];

  // Titre de la tuile résumé (étape 3) pour les pôles de POLES_AVEC_RESUME
  // — nom + localisation de l'équipement connu, famille posée pour une
  // installation neuve, ou rien pour un pôle sans équipement (le texte
  // du compte rendu suffit alors).
  const titreResume = avecNouvelEquipement(pole)
    ? [typeActif?.nom, installationLocalisation].filter(Boolean).join(" – ")
    : [equipement ? equipement.nom : avecEquipementLibre(pole) ? equipementLibre.trim() : "", equipement?.localisation ?? ""]
        .filter(Boolean)
        .join(" – ");

  // ==================== Construction + envoi ====================

  function construireInput(): Parameters<typeof enregistrerBI>[0] {
    const adresseParts = [site?.adresse ?? "", [site?.code_postal ?? "", site?.commune ?? ""].filter(Boolean).join(" ")].filter(
      (s) => s.trim(),
    );

    let equipementNomFinal = "";
    let equipementGroupeFinal = "";
    let equipementLocalisationFinal = "";
    if (avecNouvelEquipement(pole)) {
      equipementNomFinal = installationNom.trim();
      equipementGroupeFinal = installationGroupe.trim();
      equipementLocalisationFinal = installationLocalisation.trim();
    } else if (equipement) {
      equipementNomFinal = equipement.nom;
      equipementGroupeFinal = equipement.groupe;
      equipementLocalisationFinal = equipement.localisation;
    } else if (avecEquipementLibre(pole) && equipementLibre.trim()) {
      equipementNomFinal = equipementLibre.trim();
    }

    const devis = devisDuSite.find((d) => d.id === devisId) ?? null;

    const input = {
      pole,
      site_id: siteId,
      client_nom: site?.nom ?? "",
      site: site?.site ?? "",
      adresse: adresseParts.join(", "),
      email: email.trim(),
      hors_contrat: site?.hors_contrat ?? false,
      equipement_id: avecNouvelEquipement(pole) ? null : (equipement?.id ?? null),
      equipement_nom: equipementNomFinal,
      equipement_groupe: equipementGroupeFinal,
      equipement_localisation: equipementLocalisationFinal,
      devis_id: devis?.id ?? null,
      devis_numero: devis?.numero ?? "",
      devis_reference_client: devis?.reference_client ?? "",
      devis_date_commande_client: devis?.date_commande_client ?? "",
      devis_date_devis: devis?.date_devis ?? "",
      materiel_type_equipement_id: typeActif?.id ?? null,
      materiel_champs_en_tete: materielChamps,
      entretien_groupes: [...groupesSelectionnes],
      entretien_non_desservis: equipementsGroupesSelectionnes
        .filter((eq) => nonDesservisIds.has(eq.id))
        .map((eq) => ({ nom: eq.nom, motif: (motifsNonDesservi[eq.id] ?? "").trim() })),
      visite_numero: pole === Poles.entretienSousContrat && visiteNumero ? Number(visiteNumero) : null,
      visite_total: pole === Poles.entretienSousContrat && visiteTotal ? Number(visiteTotal) : null,
      visite_annee: pole === Poles.entretienSousContrat && visiteAnnee ? Number(visiteAnnee) : null,
      date_debut: dateDebut,
      date_fin: dateFin,
      date_intervention: dateIntervention,
      temps_passe: avecTempsLibre(pole) ? multiplierDuree(tempsPasse.trim(), techniciens.length) : tempsPasse.trim(),
      techniciens,
      technicien_signataire: nomUtilisateur,
      compte_rendu: compteRendu.trim(),
      obs_tech: pole === Poles.depannage ? "" : obsTech.trim(),
      obs_client: obsClient.trim(),
      modele_champs: modeleChamps,
      checklist_values: checklistValues,
      prestas: avecFournitureMateriel(pole) ? fourniture.filter((p) => p.designation.trim()) : [],
      etat_equipement: pole === Poles.depannage ? etatEquipementAEnregistrer(etatEquipement) : [],
      interventions_supplementaires: interventionsSupplementaires,
      photos: photos.filter((p) => !p.enCours).map(({ type, storage_path, horodatage }) => ({ type, storage_path, horodatage })),
      sig_tech: sigTechRef.current?.getDataUrl() ?? "",
      sig_client: sigClientRef.current?.getDataUrl() ?? "",
      signataire: signataire.trim(),
      signataire_tel_portable: signataireTelPortable.trim(),
      signataire_tel_fixe: signataireTelFixe.trim(),
      depannage_id: depannageId,
      nombre_deplacements: nombreDeplacements === "" ? 1 : nombreDeplacements,
    };
    if (!modePages) return { ...input, pole_principal: "" };

    // BI à plusieurs pages : la première page dans les champs du bon, les
    // suivantes (chacune avec son type) dans interventions_supplementaires.
    const [premiere, ...suivantes] = [...interventionsSupplementaires, pageActuelle()];
    return {
      ...input,
      pole: NATURE_MULTIPLE,
      pole_principal: premiere.pole ?? "",
      equipement_id: premiere.equipement_id,
      equipement_nom: premiere.equipement_nom,
      equipement_groupe: premiere.equipement_groupe,
      equipement_localisation: premiere.equipement_localisation,
      materiel_type_equipement_id: premiere.materiel_type_equipement_id ?? null,
      materiel_champs_en_tete: premiere.materiel_champs_en_tete ?? {},
      modele_champs: premiere.modele_champs ?? {},
      checklist_values: premiere.checklist_values ?? {},
      compte_rendu: premiere.compte_rendu,
      prestas: [],
      etat_equipement: [],
      interventions_supplementaires: suivantes,
    };
  }

  // L'onglet s'ouvre avant l'appel réseau, sinon les navigateurs le
  // bloquent. Android n'affiche pas un PDF en mémoire dans un onglet :
  // il est téléchargé puis ouvert depuis la notification.
  async function ouvrirApercu() {
    setErreurApercu(null);
    setApercuEnCours(true);
    const onglet = /android/i.test(navigator.userAgent) ? null : window.open("", "_blank");
    try {
      const reponse = await fetch("/bi/apercu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...construireInput(), sig_tech: "", sig_client: "", photos: [] }),
      });
      const estPdf = reponse.headers.get("Content-Type")?.includes("application/pdf");
      if (!reponse.ok || !estPdf) throw new Error("apercu");

      const url = URL.createObjectURL(await reponse.blob());
      if (onglet) {
        onglet.location.href = url;
      } else {
        const lien = document.createElement("a");
        lien.href = url;
        lien.download = "Apercu-BI.pdf";
        lien.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      onglet?.close();
      setErreurApercu("Aperçu indisponible (connexion ?). La signature reste possible.");
    } finally {
      setApercuEnCours(false);
    }
  }

  // Dépannage : les 2 questions d'état sont posées à chaque sortie de
  // l'étape "Compte rendu" (Suivant ou Autre équipement), pour qu'aucun
  // équipement ne parte sans réponse et qu'une réponse reste corrigeable.
  function poserQuestions(apres: "suivant" | "autre") {
    setApresQuestions(apres);
    setPopupDevis(true);
  }

  function avancerEtape() {
    if (etape === 1 && (!peutAvancerEtapeClient || manqueVisite())) {
      const manque = manqueEtapeClient();
      signaler(manque?.[0] ?? "Il manque une information pour continuer", manque?.[1] ?? null);
      return;
    }
    if (etape === 2 && resteAFaire) {
      signaler(
        "Ce devis couvre d'autres équipements",
        "wizard-autre-equipement",
        { detail: "Renseigne-les tous avec « Autre équipement » avant de continuer." },
      );
      return;
    }
    if (etape === 2 && pole === Poles.depannage) {
      poserQuestions("suivant");
      return;
    }
    setEtape(etape + 1);
  }

  function repondreDevis(reponse: boolean) {
    setDevisAEtablir(reponse);
    setPopupDevis(false);
    setPopupEtat(true);
  }

  function repondreEtat(horsService: boolean) {
    setEtatHorsService(horsService);
    setPopupEtat(false);
    if (apresQuestions === "autre") ajouterAutreEquipement(etatsDepuisReponses(devisAEtablir, horsService));
    else setEtape(etape + 1);
  }

  // BI Entretien sous contrat : équipements sans relevé technique, signalés
  // (sans bloquer) à la transmission.
  const [relevesManquants, setRelevesManquants] = useState<string[]>([]);
  const [popupReleves, setPopupReleves] = useState(false);
  const relevesConfirmesRef = useRef(false);

  function soumettre(statut: "brouillon" | "averif") {
    if (statut === "averif" && (resteAFaire || pageSuivante)) {
      signaler("Ce devis couvre d'autres équipements", null, {
        detail: "Renseigne-les tous avant de transmettre le BI.",
      });
      return;
    }
    if (statut === "averif" && tempsPasse.trim() === "") {
      setAlerteHeures(true);
      return;
    }
    if (statut === "averif" && nombreDeplacements === "") {
      setAlerteDeplacements(true);
      return;
    }
    if (statut === "averif" && techniciens.length === 0) {
      setAlerteTechnicien(true);
      return;
    }
    if (statut === "averif" && (signataire.trim() === "" || sigTechVide || sigClientVide)) {
      setAlerteSignature(true);
      return;
    }
    if (statut === "averif" && !heuresConfirmeesRef.current) {
      setPopupHeures(true);
      return;
    }
    if (
      statut === "averif" &&
      pole === Poles.entretienSousContrat &&
      relevesManquants.length > 0 &&
      !relevesConfirmesRef.current
    ) {
      setPopupReleves(true);
      return;
    }
    setErreur(null);
    setBrouillonConfirme(false);
    startEnregistrement(async () => {
      const res = await enregistrerBI(construireInput(), statut, brouillonId ?? undefined);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      if (statut === "brouillon") {
        // Reste sur l'assistant : le technicien est encore sur le
        // chantier, "Enregistrer brouillon" n'est qu'une sauvegarde de
        // ce qu'il a déjà saisi, pas une sortie de l'assistant. Les
        // clics suivants mettent à jour ce même brouillon (jamais une
        // nouvelle ligne).
        setBrouillonId(res.id ?? null);
        setBrouillonConfirme(true);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  // ==================== UI ====================

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={retour}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">
            Bon d&apos;intervention — Étape {etape - etapeDepart + 1}/{TOTAL_ETAPES - etapeDepart}
          </p>
          {modePages && etape < TOTAL_ETAPES - 1 && (
            <p className="text-xs font-semibold text-violet-700">
              Page {indexPage + 1}/{pagesDevis?.length} · {labelPole(pole)}
            </p>
          )}
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
            <div
              className={`h-full ${ACCENT}`}
              style={{ width: `${((etape - etapeDepart + 1) / (TOTAL_ETAPES - etapeDepart)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {etape === 1 && (
        <div className="space-y-4">
          <div
            className="rounded-xl border px-3.5 py-2.5"
            style={{ borderColor: `${COULEURS_POLES[pole]}66`, backgroundColor: `${COULEURS_POLES[pole]}1a` }}
          >
            <p className="text-sm font-bold" style={{ color: COULEURS_POLES[pole] }}>
              {labelPole(pole)}
            </p>
          </div>

          {brouillon && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
              <p className="text-sm font-semibold text-amber-800">Brouillon repris — rien n&apos;a été perdu.</p>
            </div>
          )}

          {pole === Poles.depannage && depannageId && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-700">
                Pré-rempli depuis le dépannage{" "}
                <span className="font-bold">
                  N°{depannagesEnCours.find((d) => d.id === depannageId)?.numero}
                </span>
              </p>
              <button onClick={annulerDepannage} className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700">
                Annuler
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <ChoixClientSite
              sites={sitesFiltres}
              clientNom={clientNom}
              siteId={siteId}
              idClient="wizard-client"
              idSite="wizard-site"
              onChange={(choix) => {
                setClientNom(choix.clientNom);
                setSiteId(choix.siteId);
              }}
            />
          </div>

          {siteId && avecAffaire(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Affaire (devis commandé)</label>
              <select
                id="wizard-devis"
                value={devisId}
                disabled={chargementSite}
                onChange={(e) => {
                  const id = e.target.value;
                  setDevisId(id);
                  const d = devisDuSite.find((x) => x.id === id);
                  const pages = d ? pagesDuDevis(d) : null;
                  if (pages) {
                    setPole(pages[0].nature);
                    setEquipementId(pages[0].equipementId ?? "");
                    return;
                  }
                  if (!avecNouvelEquipement(pole) && !avecEquipementLibre(pole) && !equipementId) {
                    if (d?.equipement_id) setEquipementId(d.equipement_id);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 disabled:bg-slate-50"
              >
                <option value="">{chargementSite ? "Chargement..." : "— Choisir l'affaire —"}</option>
                {devisDuSite.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.numero || "(sans référence)"} — {d.libelle.slice(0, 40)}
                  </option>
                ))}
              </select>
              {!chargementSite && devisDuSite.length === 0 && siteId && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Aucune affaire de cette nature pour ce site — importer un devis depuis le module Devis.
                </p>
              )}
            </div>
          )}

          {siteId && avecGroupesEntretien(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p id="wizard-groupes" className="mb-2 text-xs font-medium text-slate-600">Groupes à entretenir</p>
              {equipementsSite.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun équipement enregistré sur ce site.</p>
              ) : (
                <div className="space-y-1.5">
                  {groupesDisponibles.map((groupe) => (
                    <label key={groupe} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={groupesSelectionnes.has(groupe)}
                        onChange={(e) => toggleGroupe(groupe, e.target.checked)}
                        className="h-4 w-4 accent-violet-600"
                      />
                      {groupe}{" "}
                      <span className="text-xs text-slate-400">
                        ({equipementsSite.filter((e) => groupeEntretien(e.groupe) === groupe).length} équipement(s))
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {groupesSelectionnes.size > 0 && equipementsGroupesSelectionnes.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-base font-bold text-red-600">Équipements non entretenus (optionnel)</p>
                  {equipementsGroupesSelectionnes.map((eq) => (
                    <div key={eq.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={nonDesservisIds.has(eq.id)}
                          onChange={() => toggleNonDesservi(eq)}
                          className="h-4 w-4 accent-red-600"
                        />
                        {eq.nom}
                      </label>
                      {nonDesservisIds.has(eq.id) && (
                        <input
                          id={`wizard-motif-${eq.id}`}
                          value={motifsNonDesservi[eq.id] ?? ""}
                          onChange={(e) => setMotifsNonDesservi((prev) => ({ ...prev, [eq.id]: e.target.value }))}
                          placeholder="Motif de non-entretien"
                          className="mt-1 ml-6 w-[calc(100%-1.5rem)] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-violet-600"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {siteId && pole === Poles.entretienSousContrat && groupesSelectionnes.size > 0 && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-700">Visite d&apos;entretien</p>
              <div className="flex flex-wrap items-end gap-2 text-sm">
                <span className="pb-2 text-slate-600">Visite n°</span>
                <input
                  id="wizard-visite-numero"
                  value={visiteNumero}
                  onChange={(e) => {
                    visiteModifiee.current = true;
                    setVisiteNumero(e.target.value);
                  }}
                  inputMode="numeric"
                  className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
                />
                <span className="pb-2 text-slate-600">de</span>
                <input
                  id="wizard-visite-total"
                  value={visiteTotal}
                  onChange={(e) => {
                    visiteModifiee.current = true;
                    setVisiteTotal(e.target.value);
                  }}
                  inputMode="numeric"
                  className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
                />
                <span className="pb-2 text-slate-600">— année</span>
                <input
                  id="wizard-visite-annee"
                  value={visiteAnnee}
                  onChange={(e) => {
                    visiteModifiee.current = true;
                    setVisiteAnnee(e.target.value);
                  }}
                  inputMode="numeric"
                  className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Proposée d&apos;après les visites déjà faites — corrige si ce n&apos;est pas la bonne.
              </p>
            </div>
          )}

          {siteId && avecEquipementObligatoire(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Équipement</label>
              <div id="wizard-equipement">
                <SelectEquipement equipements={equipementsSite} value={equipementId} onChange={setEquipementId} disabled={chargementSite} />
              </div>
              {equipement?.localisation && (
                <p className="mt-1.5 text-xs font-semibold text-teal-700">Localisation : {equipement.localisation}</p>
              )}
              {equipement && pole === Poles.remplacementIdentique && (
                <div id="wizard-materiel" className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-600">Nouveau matériel</p>
                  <TypeActifSelector
                    typesEquipement={typesEquipement}
                    typeActifId={typeActifId}
                    forceTypeId={equipement.type_equipement_id}
                    onChange={(id) => {
                      setTypeActifId(id);
                      // Remplacement à l'identique : le nouveau matériel reprend
                      // par défaut les caractéristiques de l'ancien équipement
                      // (déjà connues), modifiables si le remplaçant diffère.
                      setMaterielChamps({
                        dateMES: today(),
                        typeEquipement2: champTexte(equipement.champs_en_tete, "typeEquipement2"),
                        typeEquipement3: champTexte(equipement.champs_en_tete, "typeEquipement3"),
                        puissance: champTexte(equipement.champs_en_tete, "puissance"),
                        tensionAlim: champTexte(equipement.champs_en_tete, "tensionAlim"),
                      });
                    }}
                  />
                  {typeActif?.type_equipement1_fixe && (
                    <TypeEquipementSelects
                      typeEquipement1Fixe={typeActif.type_equipement1_fixe}
                      references={references}
                      champsEnTete={materielChamps}
                      setChampsEnTete={setMaterielChampsTypeEquipement}
                    />
                  )}
                  {champsPertinents(typeActif).map((champ) => (
                    <ChampEnTeteField
                      key={champ.cle}
                      champ={champ}
                      valeur={materielChamps[champ.cle]}
                      onChange={(v) => setMaterielChamps((prev) => ({ ...prev, [champ.cle]: v }))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {siteId && avecNouvelEquipement(pole) && (
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-600">Nouvel équipement à installer</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Famille d&apos;équipement</label>
                <select
                  id="wizard-famille"
                  value={typeActifId}
                  onChange={(e) => {
                    setTypeActifId(e.target.value);
                    setMaterielChamps({ dateMES: today() });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                >
                  <option value="">—</option>
                  {typesEquipement.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Localisation</label>
                <input
                  id="wizard-localisation"
                  value={installationLocalisation}
                  onChange={(e) => setInstallationLocalisation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Groupe (optionnel)</label>
                {groupesDisponibles.length > 0 ? (
                  <select
                    value={installationGroupe}
                    onChange={(e) => setInstallationGroupe(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                  >
                    <option value="">—</option>
                    {groupesDisponibles.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={installationGroupe}
                    onChange={(e) => setInstallationGroupe(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                )}
              </div>
              {typeActif && (
                <div id="wizard-materiel" className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-600">Caractéristiques du matériel</p>
                  {typeActif.type_equipement1_fixe && (
                    <TypeEquipementSelects
                      typeEquipement1Fixe={typeActif.type_equipement1_fixe}
                      references={references}
                      champsEnTete={materielChamps}
                      setChampsEnTete={setMaterielChampsTypeEquipement}
                    />
                  )}
                  {champsPertinents(typeActif).map((champ) => (
                    <ChampEnTeteField
                      key={champ.cle}
                      champ={champ}
                      valeur={materielChamps[champ.cle]}
                      onChange={(v) => setMaterielChamps((prev) => ({ ...prev, [champ.cle]: v }))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {plusieursEquipements && interventionsSupplementaires.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Déjà renseignés sur cette visite</p>
              <div className="space-y-1.5">
                {interventionsSupplementaires.map((inter, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-700">{inter.equipement_nom}</span>
                    {!modePages && (
                      <button onClick={() => retirerAutreEquipement(i)} className="shrink-0 text-red-500">
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {siteId && avecEquipementOptionnel(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Équipement (optionnel)</label>
              <SelectEquipement equipements={equipementsSite} value={equipementId} onChange={setEquipementId} disabled={chargementSite} />
              {equipement?.localisation && (
                <p className="mt-1.5 text-xs font-semibold text-teal-700">Localisation : {equipement.localisation}</p>
              )}
              {avecEquipementLibre(pole) && !equipementId && (
                <input
                  value={equipementLibre}
                  onChange={(e) => setEquipementLibre(e.target.value)}
                  placeholder="Ou décrire l'équipement (ex : calorifuge, purgeur)"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
              )}
            </div>
          )}
        </div>
      )}

      {etape === 2 && (
        <div className="space-y-4">
          {pole === Poles.entretienSousContrat && siteId && site && (
            <RelevesVisite
              visite={visiteNumero ? `Visite ${visiteNumero}${visiteTotal ? ` de ${visiteTotal}` : ""}${visiteAnnee ? ` — ${visiteAnnee}` : ""}` : ""}
              siteId={siteId}
              site={{ nom: site.nom, site: site.site }}
              equipements={equipementsGroupesSelectionnes.filter((e) => !nonDesservisIds.has(e.id))}
              references={references}
              nomUtilisateur={nomUtilisateur}
              techniciens={techniciensDisponibles}
              onManquants={setRelevesManquants}
            />
          )}
          {modePages && pageSuivante && (
            <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
              Page suivante : {labelPole(pageSuivante.nature)}
              {pageSuivante.equipementNom ? ` — ${pageSuivante.equipementNom}` : ""}.
            </p>
          )}
          {pole !== Poles.depannage && equipementsRestants.length > 0 && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              Ce devis couvre aussi :{" "}
              {equipementsRestants.map((id) => equipementsSite.find((e) => e.id === id)?.nom ?? "un équipement").join(", ")}.
              Termine cet équipement, puis clique sur &quot;Autre équipement&quot; : tous doivent être faits sur ce BI.
            </p>
          )}
          {modele && modele.champs.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-600">Champs guidés</p>
              {modele.champs.map((champ) => (
                <ChampEnTeteField
                  key={champ.cle}
                  champ={champ}
                  valeur={modeleChamps[champ.cle]}
                  onChange={(v) => setModeleChamps((prev) => ({ ...prev, [champ.cle]: v }))}
                />
              ))}
            </div>
          )}

          {modele && modele.checklist.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium text-slate-600">Checklist</p>
              <div className="space-y-2">
                {modele.checklist.map((item) => (
                  <div key={item.rep} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">
                      {item.rep}. {item.label}
                    </span>
                    {item.typeValeur === "bool" && (
                      <input
                        type="checkbox"
                        checked={checklistValues[item.rep] === true}
                        onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.checked }))}
                        className="h-4 w-4 accent-violet-600"
                      />
                    )}
                    {item.typeValeur === "enum" && (
                      <select
                        value={typeof checklistValues[item.rep] === "string" ? (checklistValues[item.rep] as string) : ""}
                        onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-violet-600"
                      >
                        <option value="">—</option>
                        {item.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    )}
                    {item.typeValeur === "text" && (
                      <input
                        value={typeof checklistValues[item.rep] === "string" ? (checklistValues[item.rep] as string) : ""}
                        onChange={(e) => setChecklistValues((prev) => ({ ...prev, [item.rep]: e.target.value }))}
                        className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-violet-600"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-slate-600">Compte rendu</label>
            {pole === Poles.depannage &&
              (() => {
                const d = depannagesEnCours.find((x) => x.id === depannageId);
                if (!d) return null;
                return (
                  <p className="mb-2 text-sm text-slate-700">
                    {d.lieu_panne && (
                      <>
                        Lieu : {d.lieu_panne}
                        <br />
                      </>
                    )}
                    Motif : {d.message}
                  </p>
                );
              })()}
            <textarea
              value={compteRendu}
              onChange={(e) => setCompteRendu(e.target.value)}
              rows={5}
              placeholder="Détail de l'intervention..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>
          {pole !== Poles.depannage && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Observation technicien</label>
              <textarea
                value={obsTech}
                onChange={(e) => setObsTech(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
              />
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-slate-600">Photos ({photos.length}/4)</p>
            <div className="flex flex-wrap gap-2.5">
              {photos.map((p, i) => (
                <div key={i} className="relative h-24 w-24 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local d'un fichier choisi par l'utilisateur */}
                  <img src={p.preview} alt="" className="h-24 w-24 rounded-xl object-cover" />
                  {p.enCours && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-red-600 shadow"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                  <select
                    value={p.type}
                    onChange={(e) => setPhotos((prev) => prev.map((ph, idx) => (idx === i ? { ...ph, type: e.target.value } : ph)))}
                    className="mt-1 w-24 rounded-md border border-slate-200 px-1 py-0.5 text-[10px]"
                  >
                    <option value="avant">Avant</option>
                    <option value="defaut">Défaut</option>
                    <option value="pendant">Pendant</option>
                    <option value="apres">Après</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:bg-slate-50">
                  <Camera className="h-6 w-6" strokeWidth={2} />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const fichier = e.target.files?.[0];
                      e.target.value = "";
                      if (fichier) ajouterPhoto(fichier);
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {avecFournitureMateriel(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="mb-1 text-xs font-medium text-slate-600">Fourniture de matériel</p>
              <p className="mb-2 text-[11px] text-slate-400">Désignation et quantité uniquement — pas de devis pour ce pôle.</p>
              {fourniture.map((p, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input
                    value={p.designation}
                    onChange={(e) => setFourniture((prev) => prev.map((f, idx) => (idx === i ? { ...f, designation: e.target.value } : f)))}
                    placeholder="Désignation"
                    className="flex-[3] rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                  <input
                    value={p.quantite}
                    onChange={(e) => setFourniture((prev) => prev.map((f, idx) => (idx === i ? { ...f, quantite: e.target.value } : f)))}
                    placeholder="Qté"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                  <button
                    onClick={() => setFourniture((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={fourniture.length === 1}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setFourniture((prev) => [...prev, { designation: "", quantite: "" }])}
                className="inline-flex items-center gap-1 text-sm font-medium text-violet-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Ajouter une ligne
              </button>
            </div>
          )}

          {plusieursEquipements && interventionsSupplementaires.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="mb-1.5 text-xs font-medium text-slate-600">Déjà renseignés sur cette visite</p>
              <div className="space-y-1.5">
                {interventionsSupplementaires.map((inter, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-700">{inter.equipement_nom}</span>
                    {!modePages && (
                      <button onClick={() => retirerAutreEquipement(i)} className="shrink-0 text-red-500">
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {etape === 3 && (
        <div className="space-y-4">
          {recapInterventions.length > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">
                Résumé de l&apos;intervention{recapInterventions.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-2.5">
                {recapInterventions.map((r, i) => (
                  <div key={i} className={i > 0 ? "border-t border-violet-100 pt-2" : ""}>
                    <p className="text-sm font-bold text-slate-900">
                      {modePages && r.pole ? `${labelPole(r.pole)} — ` : ""}
                      {r.equipement_nom || "Équipement non précisé"}
                    </p>
                    <p className="text-sm text-slate-700">{r.compte_rendu || "—"}</p>
                    {r.etat_equipement.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.etat_equipement.map((e) => (
                          <span key={e} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            {ETATS_EQUIPEMENT[e] ?? e}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.prestas.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Fourniture : {r.prestas.map((p) => `${p.designation} ×${p.quantite}`).join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recapInterventions.length === 0 && POLES_AVEC_RESUME.has(pole) && (titreResume || compteRendu.trim()) && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">Résumé de l&apos;intervention</p>
              {titreResume && <p className="text-sm font-bold text-slate-900">{titreResume}</p>}
              {compteRendu.trim() && (
                <p className={`text-sm text-slate-700 ${titreResume ? "mt-1" : ""}`}>{compteRendu.trim()}</p>
              )}
            </div>
          )}

          <div
            ref={techniciensRef}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              champEnEvidence === "techniciens" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200/80"
            }`}
          >
            <p className="mb-2 text-xs font-medium text-slate-600">Techniciens intervenus</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {techniciens.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  {t}
                  <button onClick={() => retirerTechnicien(t)}>
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => ajouterTechnicien(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            >
              <option value="">+ Ajouter un intervenant</option>
              {techniciensDisponibles
                .filter((t) => !techniciens.includes(t))
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium text-slate-600">Dates</p>
            {avecPeriode(pole) ? (
              <div className="grid grid-cols-2 gap-2">
                <ChampDate label="Date de début" valeur={dateDebut} onChange={setDateDebut} />
                <ChampDate label="Date de fin" valeur={dateFin} onChange={setDateFin} />
              </div>
            ) : (
              <ChampDate label="Date d'intervention" valeur={dateIntervention} onChange={setDateIntervention} />
            )}
            {/* Temps passé et déplacements : demandés pour tous les BI, période ou non. */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Temps passé</label>
                <input
                  ref={tempsPasseRef}
                  value={tempsPasse}
                  onChange={(e) => {
                    setTempsManuel(true);
                    setTempsPasse(e.target.value);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-violet-600 ${
                    champEnEvidence === "heures" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200"
                  }`}
                />
                {avecTempsLibre(pole) && techniciens.length > 1 && tempsPasse.trim() && (
                  <p className="mt-1 text-xs font-semibold text-violet-700">
                    → {multiplierDuree(tempsPasse.trim(), techniciens.length)} au total pour {techniciens.length} techniciens
                  </p>
                )}
              </div>
              <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nombre de déplacements</label>
                  <input
                    ref={nombreDeplacementsRef}
                    type="number"
                    min={1}
                    value={nombreDeplacements}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDeplacementsManuel(true);
                      setNombreDeplacements(v === "" ? "" : Math.max(1, parseInt(v, 10) || 1));
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-violet-600 ${
                      champEnEvidence === "deplacements" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200"
                    }`}
                  />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-600">Signataire client</p>
            <input
              ref={signataireRef}
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
              placeholder="Nom du signataire"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-violet-600 ${
                champEnEvidence === "signataire" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200"
              }`}
            />
            <input
              value={signataireTelPortable}
              onChange={(e) => setSignataireTelPortable(e.target.value)}
              placeholder="Téléphone portable"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
            <input
              value={signataireTelFixe}
              onChange={(e) => setSignataireTelFixe(e.target.value)}
              placeholder="Téléphone fixe"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email du signataire"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={ouvrirApercu}
              disabled={apercuEnCours}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-60"
            >
              <Eye className="h-4 w-4" strokeWidth={2} />
              {apercuEnCours ? "Préparation de l'aperçu..." : "Aperçu du BI"}
            </button>
            {erreurApercu && <p className="mt-2 text-sm text-red-600">{erreurApercu}</p>}
          </div>

          <div
            ref={sigTechZoneRef}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              champEnEvidence === "sigTech" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200/80"
            }`}
          >
            <SignaturePad ref={sigTechRef} titre="Signature technicien" onChange={setSigTechVide} />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-slate-600">Observation client</label>
            <textarea
              value={obsClient}
              onChange={(e) => setObsClient(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>

          <div
            ref={sigClientZoneRef}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${
              champEnEvidence === "sigClient" ? "border-red-500 ring-2 ring-red-300" : "border-slate-200/80"
            }`}
          >
            <SignaturePad ref={sigClientRef} titre="Signature client" onChange={setSigClientVide} />
          </div>
        </div>
      )}

      {brouillonConfirme && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-brand-green-dark">
          Brouillon enregistré — retrouvable dans &quot;Prestation sur commande&quot;, bouton &quot;Reprendre le
          BI&quot;.
        </p>
      )}

      <div className="sticky bottom-0 mt-6 -mx-4 flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
        {etape > 0 && (
          <button
            onClick={retour}
            disabled={enregistrement}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Précédent
          </button>
        )}
        {etape === 2 && autreEquipementPossible && (
          <button
            id="wizard-autre-equipement"
            type="button"
            onClick={() => (pole === Poles.depannage ? poserQuestions("autre") : ajouterAutreEquipement([]))}
            disabled={!equipement && !equipementLibre.trim() && !avecNouvelEquipement(pole)}
            className="flex-1 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-40"
          >
            Autre équipement
          </button>
        )}
        {etape > 0 && etape < TOTAL_ETAPES - 1 && (
          <button
            onClick={etape === 2 && pageSuivante ? passerPageSuivante : avancerEtape}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40 ${ACCENT}`}
          >
            {etape === 2 && pageSuivante ? "Page suivante" : "Suivant"}
          </button>
        )}
        {etape === TOTAL_ETAPES - 1 && (
          <>
            <button
              onClick={() => soumettre("brouillon")}
              disabled={enregistrement}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              Enregistrer brouillon
            </button>
            <button
              onClick={() => soumettre("averif")}
              disabled={enregistrement || photosEnCours}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${ACCENT}`}
            >
              {enregistrement ? "..." : "Transmettre au bureau"}
            </button>
          </>
        )}
      </div>

      {fenetreChampManquant}

      {popupHeures && (
        <PopupChoix
          titre="Confirme avant de transmettre"
          lignes={[
            [
              "Temps passé",
              `${avecTempsLibre(pole) ? multiplierDuree(tempsPasse.trim(), techniciens.length) : tempsPasse || "—"} (${techniciens.length} technicien${techniciens.length > 1 ? "s" : ""})`,
            ],
            ["Déplacements", String(nombreDeplacements || 0)],
          ]}
          choix={[
            {
              label: "Oui, c'est juste",
              onClick: () => {
                setPopupHeures(false);
                heuresConfirmeesRef.current = true;
                soumettre("averif");
              },
            },
            {
              label: "Non, je corrige",
              onClick: () => {
                setPopupHeures(false);
                pointerVers(tempsPasseRef, "heures");
                tempsPasseRef.current?.focus();
              },
            },
          ]}
        />
      )}

      {popupReleves && (
        <PopupChoix
          titre={`${relevesManquants.length} équipement(s) sans relevé technique : ${relevesManquants.join(", ")}. Transmettre quand même ?`}
          choix={[
            {
              label: "Oui, transmettre",
              onClick: () => {
                setPopupReleves(false);
                relevesConfirmesRef.current = true;
                soumettre("averif");
              },
            },
            { label: "Non, je les fais", onClick: () => setPopupReleves(false) },
          ]}
        />
      )}

      {popupDevis && (
        <PopupChoix
          titre="Devis à établir ?"
          choix={[
            { label: "Oui", onClick: () => repondreDevis(true) },
            { label: "Non", onClick: () => repondreDevis(false) },
          ]}
        />
      )}

      {popupEtat && (
        <PopupChoix
          titre="État de l'équipement"
          choix={[
            { label: "Hors service", onClick: () => repondreEtat(true) },
            { label: "En service", onClick: () => repondreEtat(false) },
          ]}
        />
      )}

      {alerteHeures && (
        <PopupAlerte
          titre="Remplir le nombre d'heure"
          onFermer={() => {
            setAlerteHeures(false);
            pointerVers(tempsPasseRef, "heures");
          }}
        />
      )}

      {alerteDeplacements && (
        <PopupAlerte
          titre="Remplir le nombre de déplacements"
          onFermer={() => {
            setAlerteDeplacements(false);
            pointerVers(nombreDeplacementsRef, "deplacements");
          }}
        />
      )}

      {alerteTechnicien && (
        <PopupAlerte
          titre="Assigner au moins un technicien"
          onFermer={() => {
            setAlerteTechnicien(false);
            pointerVers(techniciensRef, "techniciens");
          }}
        />
      )}

      {alerteSignature && (
        <PopupAlerte
          titre="Remplir la signature"
          onFermer={() => {
            setAlerteSignature(false);
            if (signataire.trim() === "") pointerVers(signataireRef, "signataire");
            else if (sigTechVide) pointerVers(sigTechZoneRef, "sigTech");
            else if (sigClientVide) pointerVers(sigClientZoneRef, "sigClient");
          }}
        />
      )}
    </div>
  );

  function PopupAlerte({ titre, onFermer }: { titre: string; onFermer: () => void }) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onFermer}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h2 className="mb-3 text-base font-bold text-slate-900">{titre}</h2>
          <div className="flex justify-end">
            <button onClick={onFermer} className={`rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm ${ACCENT}`}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Jamais de fermeture au clic en dehors ni de case à cocher libre —
  // le technicien doit choisir une des 2 réponses pour continuer.
  function PopupChoix({
    titre,
    lignes,
    choix,
  }: {
    titre: string;
    lignes?: [string, string][];
    choix: { label: string; onClick: () => void }[];
  }) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h2 className="mb-4 text-base font-bold text-slate-900">{titre}</h2>
          {lignes && (
            <div className="mb-4 space-y-1.5 rounded-xl bg-slate-50 p-3">
              {lignes.map(([k, v]) => (
                <p key={k} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-600">{k}</span>
                  <span className="font-bold text-slate-900">{v}</span>
                </p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {choix.map((c) => (
              <button
                key={c.label}
                onClick={c.onClick}
                className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${ACCENT}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function ChampDate({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
        <input
          type="date"
          value={dateFrVersIso(valeur)}
          onChange={(e) => onChange(formaterDate(e.target.value))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
        />
      </div>
    );
  }
}

function SelectEquipement({
  equipements,
  value,
  onChange,
  disabled,
}: {
  equipements: EquipementDuSite[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const tries = [...equipements].sort((a, b) => (a.groupe + a.nom).localeCompare(b.groupe + b.nom));
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600 disabled:bg-slate-50"
    >
      <option value="">{disabled ? "Chargement..." : "— Non précisé —"}</option>
      {tries.map((eq) => (
        <option key={eq.id} value={eq.id}>
          {[eq.nom, eq.groupe, eq.localisation].filter(Boolean).join(" — ")}
        </option>
      ))}
    </select>
  );
}

function TypeActifSelector({
  typesEquipement,
  typeActifId,
  forceTypeId,
  onChange,
}: {
  typesEquipement: TypeEquipement[];
  typeActifId: string;
  forceTypeId: string;
  onChange: (id: string) => void;
}) {
  useEffect(() => {
    if (forceTypeId && typeActifId !== forceTypeId) onChange(forceTypeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceTypeId]);
  const type = typesEquipement.find((t) => t.id === typeActifId);
  return (
    <p className="text-sm text-slate-700">
      Famille : <span className="font-semibold">{type?.nom ?? "—"}</span>
    </p>
  );
}

