"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, X, Plus, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChampEnTeteField } from "@/components/gmao/champs-famille";
import { SignaturePad, type SignaturePadHandle } from "@/components/bi/signature-pad";
import type { TypeEquipement } from "@/lib/gmao/types";
import {
  Poles,
  ORDRE_AFFICHAGE_POLES,
  labelPole,
  avecAffaire,
  avecPeriode,
  avecEquipementObligatoire,
  avecGroupesEntretien,
  avecEquipementOptionnel,
  avecEquipementLibre,
  avecNouvelEquipement,
  avecTempsLibre,
  sansTempsPasse,
  avecFournitureMateriel,
  CHAMPS_MATERIEL_EXCLUS_BI,
} from "@/lib/bi/constants";
import { today, tempsStandard, multiplierDuree } from "@/lib/bi/format";
import {
  chargerEquipementsDuSite,
  chargerDevisDuSite,
  chargerModeleBI,
  enregistrerBI,
  type EquipementDuSite,
  type DevisDuSite,
  type DevisARealiser,
  type ModeleBI,
  type PhotoInput,
  type PrestaInput,
  type DepannageEnCours,
} from "./actions";

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

function champsPertinents(type: TypeEquipement | null): TypeEquipement["champs_en_tete_supplementaires"] {
  if (!type) return [];
  return type.champs_en_tete_supplementaires.filter((c) => !CHAMPS_MATERIEL_EXCLUS_BI.has(c.cle));
}

export function BiWizard({
  sites,
  techniciensDisponibles,
  typesEquipement,
  nomUtilisateur,
  depannagesEnCours,
  devisARealiser,
}: {
  sites: SiteOption[];
  techniciensDisponibles: string[];
  typesEquipement: TypeEquipement[];
  nomUtilisateur: string;
  depannagesEnCours: DepannageEnCours[];
  devisARealiser: DevisARealiser[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Boutons contextuels (carte devis dans /prestations, carte ticket
  // dans /depannages) et lien "Dépannage" de la sidebar : pré-
  // remplissage calculé dès le premier rendu, pas dans un effet après
  // coup — /bi/nouveau est la même route pour tous les BI, donc passer
  // d'une carte à une autre peut réutiliser l'instance déjà montée
  // sans jamais redéclencher un effet qui ne tournerait qu'au montage.
  function compteRenduDepuisDepannage(d: DepannageEnCours): string {
    return [d.lieu_panne ? `Lieu : ${d.lieu_panne}` : "", `Motif : ${d.message}`].filter(Boolean).join("\n");
  }

  function calculerEtatInitial() {
    const poleParam = searchParams.get("pole") ?? "";
    const devisIdParam = searchParams.get("devisId");
    const depannageIdParam = searchParams.get("depannageId");

    if (devisIdParam) {
      const d = devisARealiser.find((x) => x.id === devisIdParam);
      if (d) {
        return { etape: 1, pole: d.nature, devisId: d.id, depannageId: null as string | null, clientNom: d.client_nom, siteId: d.site_id, equipementId: "", compteRendu: "" };
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
          compteRendu: compteRenduDepuisDepannage(d),
        };
      }
    }
    if (poleParam) {
      return { etape: 1, pole: poleParam, devisId: "", depannageId: null as string | null, clientNom: "", siteId: "", equipementId: "", compteRendu: "" };
    }
    return { etape: 0, pole: "", devisId: "", depannageId: null as string | null, clientNom: "", siteId: "", equipementId: "", compteRendu: "" };
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

  const [depannageId, setDepannageId] = useState<string | null>(etatInitial.depannageId);

  // ---------- Étape 1 : Client ----------
  const [clientNom, setClientNom] = useState(etatInitial.clientNom);
  const [siteId, setSiteId] = useState(etatInitial.siteId);
  const [devisId, setDevisId] = useState(etatInitial.devisId);
  const [devisDuSite, setDevisDuSite] = useState<DevisDuSite[]>([]);
  const [equipementsSite, setEquipementsSite] = useState<EquipementDuSite[]>([]);
  const [equipementId, setEquipementId] = useState(etatInitial.equipementId);
  const [chargementSite, startChargementSite] = useTransition();

  const [typeActifId, setTypeActifId] = useState("");
  const [materielChamps, setMaterielChamps] = useState<Record<string, string>>({});
  const [installationNom, setInstallationNom] = useState("");
  const [installationLocalisation, setInstallationLocalisation] = useState("");
  const [installationGroupe, setInstallationGroupe] = useState("");
  const [equipementLibre, setEquipementLibre] = useState("");
  const [groupesSelectionnes, setGroupesSelectionnes] = useState<Set<string>>(new Set());
  const [nonDesservisIds, setNonDesservisIds] = useState<Set<string>>(new Set());
  const [motifsNonDesservi, setMotifsNonDesservi] = useState<Record<string, string>>({});

  const nomsClients = useMemo(() => [...new Set(sites.map((s) => s.nom))].sort((a, b) => a.localeCompare(b)), [sites]);
  const sitesDuClient = sites.filter((s) => s.nom === clientNom);
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

  useEffect(() => {
    if (!site) return;
    setSignataire(site.interlocuteur_site);
    setSignataireTelPortable(site.portable_interlocuteur_site);
    setSignataireTelFixe(site.tel_fixe_interlocuteur_site);
    setEmail(site.courriel_interlocuteur_site);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pré-remplissage ponctuel au choix du site, pas une synchro continue
  }, [siteId]);

  function choisirPole(code: string) {
    if (pole === code) return;
    setPole(code);
    setDevisId("");
    setEquipementId("");
    setTypeActifId("");
    setMaterielChamps({});
    setInstallationNom("");
    setInstallationLocalisation("");
    setInstallationGroupe("");
    setEquipementLibre("");
    setGroupesSelectionnes(new Set());
    setNonDesservisIds(new Set());
    setMotifsNonDesservi({});
    setDepannageId(null);
    setEtape(1);
    setTempsManuel(false);
  }

  function annulerDepannage() {
    setDepannageId(null);
  }

  // Affaires à réaliser — même principe que les dépannages en cours,
  // mais à l'étape Pôle puisque choisir une affaire détermine aussi le
  // pôle (= sa nature, voir Devis.nature). Recherche client-side, la
  // liste peut porter plusieurs centaines de lignes.
  const [rechercheAffaires, setRechercheAffaires] = useState("");
  const affairesFiltrees = devisARealiser.filter((d) =>
    `${d.client_nom} ${d.client_site} ${d.libelle}`.toLowerCase().includes(rechercheAffaires.toLowerCase()),
  );

  function choisirAffaireARealiser(d: DevisARealiser) {
    setPole(d.nature);
    setDevisId(d.id);
    setClientNom(d.client_nom);
    setSiteId(d.site_id);
    setEtape(1);
  }

  const groupesDisponibles = useMemo(
    () => [...new Set(equipementsSite.map((e) => e.groupe.trim()).filter(Boolean))].sort(),
    [equipementsSite],
  );
  const equipementsGroupesSelectionnes = equipementsSite.filter((e) => groupesSelectionnes.has(e.groupe));

  function toggleGroupe(groupe: string, coche: boolean) {
    setGroupesSelectionnes((prev) => {
      const next = new Set(prev);
      if (coche) next.add(groupe);
      else next.delete(groupe);
      return next;
    });
    if (!coche) {
      const idsDuGroupe = new Set(equipementsSite.filter((e) => e.groupe === groupe).map((e) => e.id));
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
      const eqs = equipementsSite.filter((e) => e.groupe === groupe);
      if (eqs.length === 0) continue;
      const n = eqs.length;
      lignes.push(`Entretien ${groupe} : ${n} équipement${n > 1 ? "s" : ""}.`);
    }
    const texte = lignes.join("\n");
    texteAutoEntretienRef.current = texte;
    setCompteRendu(texte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupesSelectionnes, equipementsSite]);

  // ---------- Étape 2 : Compte rendu + photos ----------
  const [compteRendu, setCompteRendu] = useState(etatInitial.compteRendu);
  const compteRenduRef = useRef("");
  compteRenduRef.current = compteRendu;
  const [obsTech, setObsTech] = useState("");
  const [obsClient, setObsClient] = useState("");
  const [photos, setPhotos] = useState<(PhotoInput & { preview: string; enCours: boolean })[]>([]);
  const [fourniture, setFourniture] = useState<PrestaInput[]>([{ designation: "", quantite: "" }]);

  // Modèle du pôle (voir Référentiel BI) — champs guidés + checklist,
  // consultés en direct à chaque changement de pôle, jamais mis en
  // cache au-delà de cette session de l'assistant.
  const [modele, setModele] = useState<ModeleBI | null>(null);
  const [modeleChamps, setModeleChamps] = useState<Record<string, string>>({});
  const [checklistValues, setChecklistValues] = useState<Record<string, boolean | string>>({});

  useEffect(() => {
    if (!pole) {
      setModele(null);
      return;
    }
    let annule = false;
    chargerModeleBI(pole).then((m) => {
      if (annule) return;
      setModele(m);
      setModeleChamps({});
      setChecklistValues({});
      if (m?.texte_type && !compteRenduRef.current.trim()) setCompteRendu(m.texte_type);
    });
    return () => {
      annule = true;
    };
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
  const [techniciens, setTechniciens] = useState<string[]>(nomUtilisateur ? [nomUtilisateur] : []);
  const [dateDebut, setDateDebut] = useState(today());
  const [dateFin, setDateFin] = useState(today());
  const [dateIntervention, setDateIntervention] = useState(today());
  const [tempsPasse, setTempsPasse] = useState("");
  const [tempsManuel, setTempsManuel] = useState(false);
  const [signataire, setSignataire] = useState("");
  const [signataireTelPortable, setSignataireTelPortable] = useState("");
  const [signataireTelFixe, setSignataireTelFixe] = useState("");
  const [email, setEmail] = useState("");
  const sigTechRef = useRef<SignaturePadHandle>(null);
  const sigClientRef = useRef<SignaturePadHandle>(null);
  const [sigTechVide, setSigTechVide] = useState(true);
  const [sigClientVide, setSigClientVide] = useState(true);

  useEffect(() => {
    if (tempsManuel) return;
    const base = avecTempsLibre(pole) ? "" : tempsStandard(dateIntervention);
    setTempsPasse(base ? multiplierDuree(base, techniciens.length) : "");
  }, [pole, dateIntervention, techniciens.length, tempsManuel]);

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
    return champsPertinents(typeActif).every((c) => (materielChamps[c.cle] ?? "").trim() !== "");
  }, [typeActif, materielChamps]);

  const peutAvancerEtapeClient = useMemo(() => {
    if (!siteId) return false;
    if (avecAffaire(pole) && !devisId) return false;
    if (avecEquipementObligatoire(pole) && !equipementId) return false;
    if (pole === Poles.remplacementIdentique && !materielComplet) return false;
    if (avecNouvelEquipement(pole)) {
      if (!installationNom.trim() || !installationLocalisation.trim()) return false;
      if (!materielComplet) return false;
    }
    if (avecGroupesEntretien(pole)) {
      if (groupesSelectionnes.size === 0) return false;
      for (const id of nonDesservisIds) {
        if (!(motifsNonDesservi[id] ?? "").trim()) return false;
      }
    }
    return true;
  }, [siteId, pole, devisId, equipementId, materielComplet, installationNom, installationLocalisation, groupesSelectionnes, nonDesservisIds, motifsNonDesservi]);

  const photosEnCours = photos.some((p) => p.enCours);
  const peutTransmettre =
    pole !== "" && siteId !== "" && techniciens.length > 0 && !sigTechVide && !sigClientVide && signataire.trim() !== "" && !photosEnCours;

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

    return {
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
      materiel_type_equipement_id: typeActif?.id ?? null,
      materiel_champs_en_tete: materielChamps,
      entretien_groupes: [...groupesSelectionnes],
      entretien_non_desservis: equipementsGroupesSelectionnes
        .filter((eq) => nonDesservisIds.has(eq.id))
        .map((eq) => ({ nom: eq.nom, motif: (motifsNonDesservi[eq.id] ?? "").trim() })),
      date_debut: dateDebut,
      date_fin: dateFin,
      date_intervention: dateIntervention,
      temps_passe: sansTempsPasse(pole)
        ? ""
        : avecTempsLibre(pole)
          ? multiplierDuree(tempsPasse.trim(), techniciens.length)
          : tempsPasse.trim(),
      techniciens,
      technicien_signataire: nomUtilisateur,
      compte_rendu: compteRendu.trim(),
      obs_tech: obsTech.trim(),
      obs_client: obsClient.trim(),
      modele_champs: modeleChamps,
      checklist_values: checklistValues,
      prestas: avecFournitureMateriel(pole) ? fourniture.filter((p) => p.designation.trim()) : [],
      photos: photos.filter((p) => !p.enCours).map(({ type, storage_path, horodatage }) => ({ type, storage_path, horodatage })),
      sig_tech: sigTechRef.current?.getDataUrl() ?? "",
      sig_client: sigClientRef.current?.getDataUrl() ?? "",
      signataire: signataire.trim(),
      signataire_tel_portable: signataireTelPortable.trim(),
      signataire_tel_fixe: signataireTelFixe.trim(),
      depannage_id: depannageId,
    };
  }

  function soumettre(statut: "brouillon" | "averif") {
    if (statut === "averif" && !peutTransmettre) {
      setErreur("Pôle, client, technicien(s), signataire et les 2 signatures sont obligatoires.");
      return;
    }
    setErreur(null);
    startEnregistrement(async () => {
      const res = await enregistrerBI(construireInput(), statut);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.push("/bi");
      router.refresh();
    });
  }

  // ==================== UI ====================

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => (etape > etapeDepart ? setEtape(etape - 1) : router.push("/bi"))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Bon d&apos;intervention — Étape {etape + 1}/{TOTAL_ETAPES}</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
            <div className={`h-full ${ACCENT}`} style={{ width: `${((etape + 1) / TOTAL_ETAPES) * 100}%` }} />
          </div>
        </div>
      </div>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</p>}

      {etape === 0 && (
        <div className="space-y-4">
          {devisARealiser.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Affaires à réaliser ({devisARealiser.length})
              </p>
              <input
                value={rechercheAffaires}
                onChange={(e) => setRechercheAffaires(e.target.value)}
                placeholder="Rechercher un client, un site..."
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
              />
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {affairesFiltrees.slice(0, 50).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => choisirAffaireARealiser(d)}
                    className="block w-full rounded-lg border border-slate-100 p-2.5 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {[d.client_nom, d.client_site].filter(Boolean).join(" — ")}
                      </p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${COULEURS_POLES[d.nature]}26`, color: COULEURS_POLES[d.nature] }}
                      >
                        {labelPole(d.nature)}
                      </span>
                    </div>
                    {d.libelle && <p className="truncate text-xs text-slate-500">{d.libelle}</p>}
                  </button>
                ))}
                {affairesFiltrees.length === 0 && (
                  <p className="py-2 text-center text-xs text-slate-400">Aucune affaire trouvée</p>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-slate-400">ou choisir un pôle directement ci-dessous</p>
            </div>
          )}

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Pôle</p>
          {ORDRE_AFFICHAGE_POLES.map((code) => {
            const selectionne = pole === code;
            const couleur = COULEURS_POLES[code];
            return (
              <button
                key={code}
                onClick={() => choisirPole(code)}
                className="flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition"
                style={{
                  borderColor: selectionne ? couleur : "#e2e8f0",
                  borderWidth: selectionne ? 2 : 1,
                  backgroundColor: selectionne ? `${couleur}1a` : "white",
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                  style={{ backgroundColor: `${couleur}26`, color: couleur }}
                >
                  {code}
                </span>
                <span className="flex-1 font-bold text-slate-900">{labelPole(code)}</span>
              </button>
            );
          })}
        </div>
      )}

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
            <label className="mb-1 block text-xs font-medium text-slate-600">Client</label>
            <select
              value={clientNom}
              onChange={(e) => {
                setClientNom(e.target.value);
                const correspondants = sites.filter((s) => s.nom === e.target.value);
                setSiteId(correspondants.length === 1 ? correspondants[0].id : "");
              }}
              className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20"
            >
              <option value="">— Choisir un client —</option>
              {nomsClients.map((nom) => (
                <option key={nom} value={nom}>
                  {nom}
                </option>
              ))}
            </select>
            {sitesDuClient.length > 1 && (
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20"
              >
                <option value="">— Choisir un site —</option>
                {sitesDuClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site || "Site sans nom"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {siteId && avecAffaire(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Affaire (devis commandé)</label>
              <select
                value={devisId}
                disabled={chargementSite}
                onChange={(e) => setDevisId(e.target.value)}
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
              <p className="mb-2 text-xs font-medium text-slate-600">Groupes à entretenir</p>
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
                        ({equipementsSite.filter((e) => e.groupe === groupe).length} équipement(s))
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {groupesSelectionnes.size > 0 && equipementsGroupesSelectionnes.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-600">Équipements non entretenus (optionnel)</p>
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

          {siteId && avecEquipementObligatoire(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Équipement</label>
              <SelectEquipement equipements={equipementsSite} value={equipementId} onChange={setEquipementId} disabled={chargementSite} />
              {equipement && pole === Poles.remplacementIdentique && (
                <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-600">Nouveau matériel</p>
                  <TypeActifSelector
                    typesEquipement={typesEquipement}
                    typeActifId={typeActifId}
                    forceTypeId={equipement.type_equipement_id}
                    onChange={(id) => {
                      setTypeActifId(id);
                      setMaterielChamps({});
                    }}
                  />
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
                  value={typeActifId}
                  onChange={(e) => {
                    setTypeActifId(e.target.value);
                    setMaterielChamps({});
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
                <label className="mb-1 block text-xs font-medium text-slate-600">Nom de l&apos;équipement</label>
                <input
                  value={installationNom}
                  onChange={(e) => setInstallationNom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Localisation</label>
                <input
                  value={installationLocalisation}
                  onChange={(e) => setInstallationLocalisation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Groupe (optionnel)</label>
                <input
                  value={installationGroupe}
                  onChange={(e) => setInstallationGroupe(e.target.value)}
                  list="groupes-existants"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                />
                <datalist id="groupes-existants">
                  {groupesDisponibles.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              {typeActif && (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-600">Caractéristiques du matériel</p>
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

          {siteId && avecEquipementOptionnel(pole) && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600">Équipement (optionnel)</label>
              <SelectEquipement equipements={equipementsSite} value={equipementId} onChange={setEquipementId} disabled={chargementSite} />
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
            <textarea
              value={compteRendu}
              onChange={(e) => setCompteRendu(e.target.value)}
              rows={5}
              placeholder="Détail de l'intervention..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-xs font-medium text-slate-600">Observation technicien</label>
            <textarea
              value={obsTech}
              onChange={(e) => setObsTech(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>

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
        </div>
      )}

      {etape === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
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
              <>
                <ChampDate label="Date d'intervention" valeur={dateIntervention} onChange={setDateIntervention} />
                {!sansTempsPasse(pole) && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Temps passé</label>
                    <input
                      value={tempsPasse}
                      onChange={(e) => {
                        setTempsManuel(true);
                        setTempsPasse(e.target.value);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                    {avecTempsLibre(pole) && techniciens.length > 1 && tempsPasse.trim() && (
                      <p className="mt-1 text-xs font-semibold text-violet-700">
                        → {multiplierDuree(tempsPasse.trim(), techniciens.length)} au total pour {techniciens.length} techniciens
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-600">Signataire client</p>
            <input
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
              placeholder="Nom du signataire"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
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

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
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

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <SignaturePad ref={sigClientRef} titre="Signature client" onChange={setSigClientVide} />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 mt-6 -mx-4 flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
        {etape > 0 && (
          <button
            onClick={() => (etape > etapeDepart ? setEtape(etape - 1) : router.push("/bi"))}
            disabled={enregistrement}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Précédent
          </button>
        )}
        {etape > 0 && etape < TOTAL_ETAPES - 1 && (
          <button
            onClick={() => setEtape(etape + 1)}
            disabled={etape === 1 && !peutAvancerEtapeClient}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40 ${ACCENT}`}
          >
            Suivant
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
              disabled={enregistrement}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${ACCENT}`}
            >
              {enregistrement ? "..." : "Transmettre au bureau"}
            </button>
          </>
        )}
      </div>
    </div>
  );

  function ChampDate({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
        <input
          type="text"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          placeholder="jj/mm/aaaa"
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

