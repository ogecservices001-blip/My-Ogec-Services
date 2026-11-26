"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText, Mail } from "lucide-react";
import { ChoixClientSite } from "@/components/choix-client-site";
import { ListeRecherche, type OptionRecherche } from "@/components/liste-recherche";
import { SignaturePad, type SignaturePadHandle } from "@/components/bi/signature-pad";
import { useChampManquant } from "@/components/champ-manquant";
import {
  FLUIDES,
  cleReference,
  estInflammable,
  fluideCerfa,
  classement,
  statutSoumission,
  teqCO2,
  texteChamp,
} from "@/lib/cerfa/regles";
import { casesPeriodicite, natureRenseignee, quantiteChargee, quantiteRecuperee } from "@/lib/cerfa/calculs";
import { donneesVides, type CerfaDonnees } from "@/lib/cerfa/types";
import {
  ajouterDetecteur,
  chargerDetecteurs,
  chargerEquipementsCerfa,
  envoyerCerfaParEmail,
  finaliserCerfa,
  supprimerDetecteur,
  type Detecteur,
  type EquipementCerfa,
} from "../actions";
import { BasculeContrat } from "../bascule-contrat";

export type SiteCerfa = {
  id: string;
  nom: string;
  site: string;
  n_affaire: string;
  adresse: string;
  complement_adresse: string;
  code_postal: string;
  commune: string;
  interlocuteur_site: string;
  qualite_interlocuteur_site: string;
  courriel_interlocuteur_site: string;
  interlocuteur_site_2: string;
  qualite_interlocuteur_site_2: string;
  courriel_interlocuteur_site_2: string;
  interlocuteur_site_3: string;
  qualite_interlocuteur_site_3: string;
  courriel_interlocuteur_site_3: string;
  interlocuteur_site_4: string;
  qualite_interlocuteur_site_4: string;
  courriel_interlocuteur_site_4: string;
};

const CARTE = "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";
const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600";
const TITRE = "mb-3 text-sm font-bold uppercase tracking-wide text-indigo-700";

const ECRANS = [
  "Écran 1 : Choix de l'équipement",
  "Écran 2 : Équipement & Fluide",
  "Écran 3 : Détection & Périodicité",
  "Écran 4 : Manipulation du fluide",
  "Écran 5a : Récapitulatif",
  "Écran 5b : Signatures",
  "Écran 6 : Envoi au client",
];

function signatairesDuSite(s: SiteCerfa | undefined) {
  if (!s) return [];
  return [
    [s.interlocuteur_site, s.qualite_interlocuteur_site, s.courriel_interlocuteur_site],
    [s.interlocuteur_site_2, s.qualite_interlocuteur_site_2, s.courriel_interlocuteur_site_2],
    [s.interlocuteur_site_3, s.qualite_interlocuteur_site_3, s.courriel_interlocuteur_site_3],
    [s.interlocuteur_site_4, s.qualite_interlocuteur_site_4, s.courriel_interlocuteur_site_4],
  ]
    .map(([nom, qualite, email], i) => ({ place: i + 1, nom: nom ?? "", qualite: qualite ?? "", email: email ?? "" }))
    .filter((x) => x.nom.trim());
}

const dateIsoVersFr = (iso: string) => iso.split("-").reverse().join("/");

function Case({ id, label, checked, onChange, disabled }: { id?: string; label: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label id={id} className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-500" : "text-slate-700"}`}>
      <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      {label}
    </label>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="w-48 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-800">{valeur || "—"}</span>
    </div>
  );
}

function Boutons({
  precedent,
  suivant,
  libelleSuivant = "Valider",
  occupe,
  onAbandon,
}: {
  precedent: (() => void) | null;
  suivant: () => void;
  libelleSuivant?: string;
  occupe: boolean;
  onAbandon: () => void;
}) {
  return (
    <div className="sticky bottom-0 mt-6 -mx-4 flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
      <button
        type="button"
        onClick={precedent ?? onAbandon}
        disabled={occupe}
        className="flex-1 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
      >
        {precedent ? "Retour" : "Abandon"}
      </button>
      <button
        type="button"
        onClick={suivant}
        disabled={occupe}
        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
      >
        {libelleSuivant}
      </button>
    </div>
  );
}

export function CerfaWizard({
  sites,
  operateurNom,
  depart,
  horsContrat,
  fermerALaFin = false,
}: {
  sites: SiteCerfa[];
  operateurNom: string;
  depart: { siteId: string; equipementId: string } | null;
  horsContrat: boolean;
  /// Ouvert dans un nouvel onglet depuis un BI ou un relevé : on ferme
  /// l'onglet à la fin pour revenir à la saisie en cours.
  fermerALaFin?: boolean;
}) {
  const router = useRouter();
  const quitter = () => {
    if (fermerALaFin) window.close();
    router.push("/");
  };
  const { signaler, fenetre } = useChampManquant();
  const [etape, setEtape] = useState(0);

  const siteDepart = sites.find((s) => s.id === depart?.siteId);
  const [clientNom, setClientNom] = useState(siteDepart?.nom ?? "");
  const [siteId, setSiteId] = useState(siteDepart?.id ?? "");
  const [equipements, setEquipements] = useState<EquipementCerfa[]>([]);
  const [equipementId, setEquipementId] = useState(depart?.equipementId ?? "");
  const [d, setD] = useState<CerfaDonnees>(donneesVides());
  const maj = (p: Partial<CerfaDonnees>) => setD((x) => ({ ...x, ...p }));

  const [detecteurs, setDetecteurs] = useState<Detecteur[]>([]);
  const [detecteurId, setDetecteurId] = useState("");
  const [fuiteChoisie, setFuiteChoisie] = useState(false);
  const [ajoutDetecteur, setAjoutDetecteur] = useState<{ reference: string; date: string } | null>(null);

  const [operateur, setOperateur] = useState(operateurNom);
  const [signataireChoisi, setSignataireChoisi] = useState("");
  const [signataire, setSignataire] = useState({ nom: "", qualite: "", email: "" });
  const sigOperateur = useRef<SignaturePadHandle>(null);
  const sigDetenteur = useRef<SignaturePadHandle>(null);
  const [enCours, setEnCours] = useState("");
  const [resultat, setResultat] = useState<{ id: string; numero: string; ficheNo: string; avertissement?: string } | null>(null);
  const [emailEnvoi, setEmailEnvoi] = useState("");
  const [envoye, setEnvoye] = useState(false);

  const site = sites.find((s) => s.id === siteId);
  const equipement = equipements.find((e) => e.id === equipementId);
  const signataires = useMemo(() => signatairesDuSite(site), [site]);

  const siteDemande = useRef("");

  function chargerSite(id: string, equipementVoulu: string) {
    siteDemande.current = id;
    if (!id) return;
    chargerEquipementsCerfa(id).then((liste) => {
      if (siteDemande.current !== id) return;
      setEquipements(liste);
      setEquipementId(liste.some((e) => e.id === equipementVoulu) ? equipementVoulu : liste.length === 1 ? liste[0].id : "");
    });
  }

  function changerSite(id: string) {
    setSiteId(id);
    setEquipements([]);
    setEquipementId("");
    setD(donneesVides());
    setFuiteChoisie(false);
    chargerSite(id, "");
  }

  useEffect(() => {
    if (depart) chargerSite(depart.siteId, depart.equipementId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à l'ouverture (CERFA lancé depuis un équipement)
  }, []);

  useEffect(() => {
    chargerDetecteurs().then(setDetecteurs);
  }, []);

  const optionsEquipements: OptionRecherche[] = equipements.map((e) => {
    const statut = statutSoumission(e.champs_en_tete);
    const charge = texteChamp(e.champs_en_tete, "chargeRefrigerant");
    return {
      valeur: e.id,
      label: e.nom,
      detail: [
        e.numero_equipement,
        statut === "charge_inconnue" ? "charge à relever" : `${charge} kg${statut === "non_soumis" ? " (≤ 2 kg)" : ""}`,
      ]
        .filter(Boolean)
        .join(" — "),
    };
  });

  const ligne3 = site ? (site.complement_adresse ? site.complement_adresse : `${site.code_postal} - ${site.commune}`) : "";

  function allerEtape2() {
    if (!equipement) return signaler("Choisis un équipement", "choix-equipement");
    const c = equipement.champs_en_tete;
    const fluide = fluideCerfa(texteChamp(c, "typeRefrigerant"));
    const charge = texteChamp(c, "chargeRefrigerant");
    setD((x) => ({
      ...x,
      equipementMarque: x.equipementMarque || texteChamp(c, "marque"),
      equipementDateMES: x.equipementDateMES || texteChamp(c, "dateMES"),
      equipementReference: x.equipementReference || texteChamp(c, cleReference(equipement.type_equipement_id)),
      equipementLocalisation: x.equipementLocalisation || equipement.localisation || "",
      equipementFluide: x.equipementFluide || fluide,
      equipementCharge: x.equipementCharge || charge,
    }));
    setEtape(1);
  }

  function allerEtape3() {
    if (!d.equipementFluide) return signaler("Choisis le fluide frigorigène", "fluide");
    if (!natureRenseignee(d)) return signaler("Coche au moins une nature d'intervention", "natures");
    if (d.caseAutre && !d.autreTexte.trim()) return signaler("Précise la nature de l'intervention « Autre »", "autre-texte");
    setEtape(2);
  }

  function allerEtape4() {
    const det = detecteurs.find((x) => x.id === detecteurId);
    if (!det) return signaler("Choisis un détecteur", "detecteur");
    if (!fuiteChoisie) return signaler("Indique si des fuites ont été constatées", "fuites");
    maj({ detecteurReference: det.reference, detecteurDateControle: dateIsoVersFr(det.date_controle) });
    setEtape(3);
  }

  async function validerAjoutDetecteur() {
    if (!ajoutDetecteur) return;
    const r = await ajouterDetecteur(ajoutDetecteur.reference, ajoutDetecteur.date);
    if (!r.ok) return signaler(r.erreur);
    const liste = await chargerDetecteurs();
    setDetecteurs(liste);
    const nouveau = liste.find((x) => x.reference === ajoutDetecteur.reference.trim());
    if (nouveau) setDetecteurId(nouveau.id);
    setAjoutDetecteur(null);
  }

  async function supprimerDetecteurChoisi() {
    const det = detecteurs.find((x) => x.id === detecteurId);
    if (!det || !confirm(`Supprimer ce détecteur ?\nRéférence : ${det.reference}`)) return;
    const r = await supprimerDetecteur(det.id);
    if (!r.ok) return signaler(r.erreur);
    setDetecteurId("");
    setDetecteurs(await chargerDetecteurs());
  }

  function choisirSignataire(valeur: string) {
    setSignataireChoisi(valeur);
    const s = signataires.find((x) => String(x.place) === valeur);
    setSignataire(s ? { nom: s.nom, qualite: s.qualite, email: s.email } : { nom: "", qualite: "", email: "" });
  }

  async function valider() {
    if (!operateur.trim()) return signaler("Renseigne ton nom (technicien)", "operateur");
    if (!signataireChoisi) return signaler("Choisis le signataire client", "signataire");
    if (!signataire.nom.trim()) return signaler("Renseigne le nom du signataire", "signataire-nom");
    const op = sigOperateur.current?.getDataUrl() ?? "";
    const det = sigDetenteur.current?.getDataUrl() ?? "";
    if (!op) return signaler("Signe dans la case « Signature du technicien »", "sig-operateur");
    if (!det) return signaler("Fais signer le client dans la case « Signature du client »", "sig-detenteur");
    setEnCours("Attribution du numéro, génération et archivage du PDF…");
    const r = await finaliserCerfa({
      equipementId,
      donnees: d,
      operateurNom: operateur,
      signataire,
      nouveauSignataire: signataireChoisi === "__nouveau__",
      signatureOperateur: op,
      signatureDetenteur: det,
    });
    setEnCours("");
    if (!r.ok) return signaler("Le CERFA n'a pas pu être finalisé", null, { detail: r.erreur });
    setResultat({ id: r.id!, numero: r.numero!, ficheNo: r.ficheNo!, avertissement: r.avertissement });
    setEmailEnvoi(r.emailClient ?? "");
    setEtape(6);
  }

  async function envoyer() {
    if (!resultat) return;
    if (!emailEnvoi.trim()) return signaler("Renseigne une adresse email destinataire", "email-envoi");
    setEnCours("Envoi du mail…");
    const r = await envoyerCerfaParEmail(resultat.id, emailEnvoi.split(/[;,]/));
    setEnCours("");
    if (!r.ok) return signaler("Mail non envoyé", "email-envoi", { detail: r.erreur });
    setEnvoye(true);
  }

  const p = casesPeriodicite(d.equipementFluide, d.equipementCharge, d.systemePermanent);
  const cl = classement(d.equipementFluide, d.equipementCharge, d.systemePermanent);
  const inflammable = estInflammable(d.equipementFluide);
  const teq = teqCO2(d.equipementFluide, d.equipementCharge);

  const enTeteEquipement = equipement && (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
      <p className="font-bold text-slate-900">Équipement : {equipement.nom}</p>
      <p className="text-slate-600">
        {site?.nom} — {site?.site} ({site?.n_affaire})
      </p>
      <p className="italic text-slate-500">N° de CERFA : attribué à la validation</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      {fenetre}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Nouveau CERFA 15497</h1>
          <p className="text-sm text-slate-500">
            {ECRANS[etape]}
            {etape === 0 ? ` — Clients ${horsContrat ? "hors contrat" : "sous contrat"}` : ""}
          </p>
        </div>
        {etape === 0 && <BasculeContrat base="/cerfa/nouveau" horsContrat={horsContrat} />}
      </div>
      {enCours && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{enCours}</p>}

      {etape === 0 && (
        <div className="space-y-4">
          <div className={CARTE}>
            <ChoixClientSite
              sites={sites}
              clientNom={clientNom}
              siteId={siteId}
              onChange={({ clientNom: c, siteId: s }) => {
                setClientNom(c);
                if (s !== siteId) changerSite(s);
              }}
            />
            {siteId && (
              <div className="mt-3">
                <label className={ETIQUETTE}>Nom Équipement</label>
                <ListeRecherche
                  id="choix-equipement"
                  options={optionsEquipements}
                  valeur={equipementId}
                  onChange={(v) => {
                    setEquipementId(v);
                    setD(donneesVides());
                    setFuiteChoisie(false);
                  }}
                  vide="Aucun équipement à fluide sur ce site"
                />
              </div>
            )}
          </div>
          {equipement && site && (
            <div className={CARTE}>
              <p className={TITRE}>Informations de l&apos;équipement</p>
              <Ligne label="N° équipement" valeur={equipement.numero_equipement} />
              <Ligne label="N° affaire" valeur={site.n_affaire} />
              <Ligne label="Marque" valeur={texteChamp(equipement.champs_en_tete, "marque")} />
              <Ligne label="Date M.E.S." valeur={texteChamp(equipement.champs_en_tete, "dateMES")} />
              <Ligne label="Référence" valeur={texteChamp(equipement.champs_en_tete, cleReference(equipement.type_equipement_id))} />
              <Ligne label="Localisation" valeur={equipement.localisation} />
              <Ligne label="Réfrigérant" valeur={texteChamp(equipement.champs_en_tete, "typeRefrigerant")} />
              <Ligne label="Charge" valeur={texteChamp(equipement.champs_en_tete, "chargeRefrigerant")} />
              <Ligne label="Adresse" valeur={site.adresse} />
              <Ligne label="Complément d'adresse" valeur={site.complement_adresse} />
              <Ligne label="Code Postal" valeur={site.code_postal} />
              <Ligne label="Commune" valeur={site.commune} />
              <Ligne label="Date dernier contrôle" valeur={texteChamp(equipement.champs_en_tete, "dateDernierControle")} />
              <Ligne label="Date prochain contrôle" valeur={texteChamp(equipement.champs_en_tete, "dateProchainControle")} />
              <Ligne label="N° dernier bordereau" valeur={texteChamp(equipement.champs_en_tete, "numDernierBordereau")} />
            </div>
          )}
          <Boutons precedent={null} suivant={allerEtape2} occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 1 && (
        <div className="space-y-4">
          {enTeteEquipement}
          <div className={CARTE}>
            <p className={TITRE}>Informations équipement (modifiables)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["equipementMarque", "Marque"],
                  ["equipementDateMES", "Date M.E.S."],
                  ["equipementReference", "Référence"],
                  ["equipementLocalisation", "Localisation"],
                ] as const
              ).map(([cle, label]) => (
                <div key={cle}>
                  <label className={ETIQUETTE} htmlFor={cle}>
                    {label}
                  </label>
                  <input id={cle} className={CHAMP} value={d[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Fluide frigorigène</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={ETIQUETTE} htmlFor="fluide">
                  Fluide frigorigène
                </label>
                <select id="fluide" className={CHAMP} value={d.equipementFluide} onChange={(e) => maj({ equipementFluide: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {[...new Set([...FLUIDES, ...(d.equipementFluide ? [d.equipementFluide] : [])])].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ETIQUETTE} htmlFor="charge">
                  Charge (kg)
                </label>
                <input id="charge" inputMode="decimal" className={CHAMP} value={d.equipementCharge} onChange={(e) => maj({ equipementCharge: e.target.value })} />
              </div>
              <div>
                <span className={ETIQUETTE}>Tonnage équivalent CO2</span>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{teq} t.éq.CO2</p>
              </div>
            </div>
          </div>
          <div className={CARTE} id="natures">
            <p className={TITRE}>Nature de l&apos;intervention</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Case label="Assemblage" checked={d.caseAssemblage} onChange={(v) => maj({ caseAssemblage: v })} />
              <Case label="Mise en service" checked={d.caseMiseService} onChange={(v) => maj({ caseMiseService: v })} />
              <Case label="Modification" checked={d.caseModif} onChange={(v) => maj({ caseModif: v })} />
              <Case label="Maintenance" checked={d.caseMaintenance} onChange={(v) => maj({ caseMaintenance: v })} />
              <Case label="Contrôle périodique" checked={d.caseCtrlPerio} onChange={(v) => maj({ caseCtrlPerio: v })} />
              <Case label="Contrôle non périodique" checked={d.caseCtrlNonPerio} onChange={(v) => maj({ caseCtrlNonPerio: v })} />
              <Case label="Démantèlement" checked={d.caseDemantel} onChange={(v) => maj({ caseDemantel: v })} />
              <Case label="Autre (préciser)" checked={d.caseAutre} onChange={(v) => maj({ caseAutre: v })} />
            </div>
            {d.caseAutre && (
              <div className="mt-3">
                <label className={ETIQUETTE} htmlFor="autre-texte">
                  Précisez la nature de l&apos;intervention
                </label>
                <input id="autre-texte" className={CHAMP} value={d.autreTexte} onChange={(e) => maj({ autreTexte: e.target.value })} />
              </div>
            )}
          </div>
          <Boutons precedent={() => setEtape(0)} suivant={allerEtape3} occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 2 && (
        <div className="space-y-4">
          {enTeteEquipement}
          <div className={CARTE}>
            <p className={TITRE}>5 - Détecteur de fuite</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className={ETIQUETTE} htmlFor="detecteur">
                  Détecteur
                </label>
                <select id="detecteur" className={CHAMP} value={detecteurId} onChange={(e) => setDetecteurId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {detecteurs.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.reference} — {dateIsoVersFr(x.date_controle)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                title="Ajouter un détecteur"
                onClick={() => setAjoutDetecteur({ reference: "", date: new Date().toISOString().slice(0, 10) })}
                className="rounded-lg border border-slate-200 p-2 text-indigo-600 hover:bg-indigo-50"
              >
                <Plus className="h-5 w-5" />
              </button>
              {detecteurId && (
                <button type="button" title="Supprimer ce détecteur" onClick={supprimerDetecteurChoisi} className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <div className={CARTE}>
            <p className={TITRE}>6 - Système permanent de détection de fuite</p>
            <div className="flex gap-6">
              <Case label="Oui" checked={d.systemePermanent} onChange={(v) => maj({ systemePermanent: v })} />
              <Case label="Non" checked={!d.systemePermanent} onChange={(v) => maj({ systemePermanent: !v })} />
            </div>
          </div>
          <div className={CARTE}>
            <p className={TITRE}>
              7 - Quantité de fluide ({d.equipementFluide || "—"} — {d.equipementCharge || "—"} kg — {teq} t.éq.CO2)
            </p>
            {cl.categorie === "HCFC" ? (
              <div className="space-y-1.5">
                <Case label="HCFC : 2 kg ≤ Q < 30 kg" checked={p.Case_HCFC_2} disabled />
                <Case label="HCFC : 30 kg ≤ Q < 300 kg" checked={p.Case_HCFC_30} disabled />
                <Case label="HCFC : Q ≥ 300 kg" checked={p.Case_HCFC_300} disabled />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Case label="HFC : 5 t ≤ teqCO2 < 50 t" checked={p.Case_HFC_5} disabled />
                <Case label="HFC : 50 t ≤ teqCO2 < 500 t" checked={p.Case_HFC_50} disabled />
                <Case label="HFC : teqCO2 ≥ 500 t" checked={p.Case_HFC_500} disabled />
              </div>
            )}
            {cl.palier === 0 && (
              <p className="mt-2 text-xs text-slate-500">Sous le seuil réglementaire ({cl.libellePalier}) : aucune case, prochain contrôle dans 12 mois.</p>
            )}
            <p className={`${TITRE} mt-4`}>Fréquence minimale du contrôle périodique</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <Case label="Sans détection permanente : 12 mois" checked={p.Case_Sans_12m} disabled />
              <Case label="Avec détection permanente : 24 mois" checked={p.Case_Avec_24m} disabled />
              <Case label="Sans détection permanente : 6 mois" checked={p.Case_Sans_6m} disabled />
              <Case label="Avec détection permanente : 12 mois" checked={p.Case_Avec_12m} disabled />
              <Case label="Sans détection permanente : 3 mois" checked={p.Case_Sans_3m} disabled />
              <Case label="Avec détection permanente : 6 mois" checked={p.Case_Avec_6m} disabled />
            </div>
          </div>
          <div className={CARTE} id="fuites">
            <p className={TITRE}>Fuites constatées lors du contrôle d&apos;étanchéité</p>
            <div className="flex gap-6">
              <Case
                label="OUI"
                checked={fuiteChoisie && d.fuiteConstatee}
                onChange={(v) => {
                  setFuiteChoisie(v);
                  maj({ fuiteConstatee: v });
                }}
              />
              <Case
                label="NON"
                checked={fuiteChoisie && !d.fuiteConstatee}
                onChange={(v) => {
                  setFuiteChoisie(v);
                  maj({ fuiteConstatee: false });
                }}
              />
            </div>
            {d.fuiteConstatee && (
              <div className="mt-4 space-y-3">
                {d.fuites.map((fu, i) => (
                  <div key={i} className="rounded-xl border border-indigo-100 p-3">
                    <p className="mb-2 text-sm font-bold text-slate-800">Fuite {i + 1}</p>
                    <input
                      className={CHAMP}
                      placeholder="Localisation de la fuite"
                      value={fu.localisation}
                      onChange={(e) => maj({ fuites: d.fuites.map((x, j) => (j === i ? { ...x, localisation: e.target.value } : x)) })}
                    />
                    <div className="mt-2 flex gap-6">
                      <Case
                        label="Réalisée"
                        checked={fu.realisee}
                        onChange={(v) => maj({ fuites: d.fuites.map((x, j) => (j === i ? { ...x, realisee: v, aFaire: v ? false : x.aFaire } : x)) })}
                      />
                      <Case
                        label="À faire"
                        checked={fu.aFaire}
                        onChange={(v) => maj({ fuites: d.fuites.map((x, j) => (j === i ? { ...x, aFaire: v, realisee: v ? false : x.realisee } : x)) })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Boutons precedent={() => setEtape(1)} suivant={allerEtape4} occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 3 && (
        <div className="space-y-4">
          {enTeteEquipement}
          <div className={CARTE}>
            <p className={TITRE}>Fluide chargé</p>
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Quantité chargée totale (A+B+C) : <b>{quantiteChargee(d)} kg</b>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["qa", "A - Dont fluide vierge (kg)", true],
                  ["denom", "Dénomination du fluide chargé si changement", false],
                  ["qb", "B - Dont fluide recyclé (kg)", true],
                  ["qc", "C - Dont fluide régénéré (kg)", true],
                ] as const
              ).map(([cle, label, num]) => (
                <div key={cle}>
                  <label className={ETIQUETTE} htmlFor={cle}>
                    {label}
                  </label>
                  <input id={cle} inputMode={num ? "decimal" : undefined} className={CHAMP} value={d[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Fluide récupéré</p>
            <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              Quantité de fluide récupérée totale (D+E) : <b>{quantiteRecuperee(d)} kg</b>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["qd", "D - Dont fluide destiné au traitement (kg)", true],
                  ["bsff", "Si connu, numéro du BSFF (Trackdéchets)", false],
                  ["qe", "E - Dont fluide conservé pour réutilisation (kg)", true],
                  ["contenantId", "Identification du ou des contenants", false],
                ] as const
              ).map(([cle, label, num]) => (
                <div key={cle}>
                  <label className={ETIQUETTE} htmlFor={cle}>
                    {label}
                  </label>
                  <input id={cle} inputMode={num ? "decimal" : undefined} className={CHAMP} value={d[cle]} onChange={(e) => maj({ [cle]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Classification UN</p>
            <div className="space-y-1.5">
              <Case label="UN 1078 — R-410A / R-134a / R-407C / R22" checked={!!d.equipementFluide && !inflammable} disabled />
              <Case label="UN 3161 — R32" checked={inflammable} disabled />
            </div>
          </div>
          <div className={CARTE}>
            <label className={TITRE} htmlFor="observations">
              Observations
            </label>
            <textarea id="observations" rows={4} className={CHAMP} placeholder="Observations libres…" value={d.observations} onChange={(e) => maj({ observations: e.target.value })} />
          </div>
          <Boutons precedent={() => setEtape(2)} suivant={() => setEtape(4)} occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 4 && equipement && site && (
        <div className="space-y-4">
          <div className={CARTE}>
            <p className={TITRE}>Opérateur & Détenteur</p>
            <Ligne label="Détenteur" valeur={`${site.nom} ${site.site} — ${site.adresse} — ${ligne3}`} />
            <Ligne label="Équipement" valeur={equipement.nom} />
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Équipement & Fluide</p>
            <Ligne label="Marque" valeur={d.equipementMarque} />
            <Ligne label="Date M.E.S." valeur={d.equipementDateMES} />
            <Ligne label="Référence" valeur={d.equipementReference} />
            <Ligne label="Localisation" valeur={d.equipementLocalisation} />
            <Ligne label="Fluide" valeur={d.equipementFluide} />
            <Ligne label="Charge" valeur={d.equipementCharge ? `${d.equipementCharge} kg` : ""} />
            <Ligne label="Tonnage éq. CO2" valeur={`${teq} t`} />
            <Ligne
              label="Nature"
              valeur={[
                d.caseAssemblage && "Assemblage",
                d.caseMiseService && "Mise en service",
                d.caseModif && "Modification",
                d.caseMaintenance && "Maintenance",
                d.caseCtrlPerio && "Contrôle périodique",
                d.caseCtrlNonPerio && "Contrôle non périodique",
                d.caseDemantel && "Démantèlement",
                d.caseAutre && `Autre : ${d.autreTexte}`,
              ]
                .filter(Boolean)
                .join(", ")}
            />
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Détection & Périodicité</p>
            <Ligne label="Détecteur" valeur={`${d.detecteurReference} — contrôlé le ${d.detecteurDateControle}`} />
            <Ligne label="Système permanent" valeur={d.systemePermanent ? "Oui" : "Non"} />
            <Ligne label="Périodicité" valeur={`${cl.mois} mois (${cl.categorie} ${cl.libellePalier})`} />
            <Ligne label="Fuites constatées" valeur={d.fuiteConstatee ? "Oui" : "Non"} />
            {d.fuiteConstatee &&
              d.fuites
                .filter((fu) => fu.localisation.trim())
                .map((fu, i) => <Ligne key={i} label={`Fuite ${i + 1}`} valeur={`${fu.localisation} — ${fu.realisee ? "réalisée" : fu.aFaire ? "à faire" : "—"}`} />)}
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Manipulation du fluide</p>
            <Ligne label="Chargée totale (A+B+C)" valeur={`${quantiteChargee(d)} kg`} />
            <Ligne label="Récupérée totale (D+E)" valeur={`${quantiteRecuperee(d)} kg`} />
            <Ligne label="Classification" valeur={inflammable ? "UN 3161" : "UN 1078"} />
            <Ligne label="Observations" valeur={d.observations} />
          </div>
          <Boutons precedent={() => setEtape(3)} suivant={() => setEtape(5)} libelleSuivant="Passer aux signatures" occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 5 && site && (
        <div className="space-y-4">
          {enTeteEquipement}
          <div className={CARTE}>
            <p className={TITRE}>Signataire client</p>
            <label className={ETIQUETTE} htmlFor="signataire">
              Signataire connu
            </label>
            <select id="signataire" className={CHAMP} value={signataireChoisi} onChange={(e) => choisirSignataire(e.target.value)}>
              <option value="">— Choisir —</option>
              {signataires.map((s) => (
                <option key={s.place} value={String(s.place)}>
                  {s.nom}
                  {s.qualite ? ` – ${s.qualite}` : ""}
                </option>
              ))}
              <option value="__nouveau__">+ Nouveau signataire</option>
            </select>
            {signataireChoisi && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={ETIQUETTE} htmlFor="signataire-nom">
                    Nom du signataire
                  </label>
                  <input id="signataire-nom" className={CHAMP} value={signataire.nom} onChange={(e) => setSignataire({ ...signataire, nom: e.target.value })} />
                </div>
                <div>
                  <label className={ETIQUETTE} htmlFor="signataire-qualite">
                    Qualité du signataire
                  </label>
                  <input id="signataire-qualite" className={CHAMP} value={signataire.qualite} onChange={(e) => setSignataire({ ...signataire, qualite: e.target.value })} />
                </div>
                <div>
                  <label className={ETIQUETTE} htmlFor="signataire-email">
                    Email
                  </label>
                  <input id="signataire-email" type="email" className={CHAMP} value={signataire.email} onChange={(e) => setSignataire({ ...signataire, email: e.target.value })} />
                </div>
              </div>
            )}
            {signataireChoisi === "__nouveau__" && (
              <p className="mt-2 text-xs text-slate-500">Il sera ajouté aux interlocuteurs du site, dans la première place libre.</p>
            )}
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Opérateur</p>
            <label className={ETIQUETTE} htmlFor="operateur">
              Votre nom complet
            </label>
            <input id="operateur" className={CHAMP} value={operateur} onChange={(e) => setOperateur(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Qualité : Frigoriste — Date : {new Date().toLocaleDateString("fr-FR")}</p>
          </div>
          <div className={CARTE} id="sig-operateur">
            <SignaturePad ref={sigOperateur} titre="Signature du technicien" />
          </div>
          <div className={CARTE} id="sig-detenteur">
            <SignaturePad ref={sigDetenteur} titre={`Signature du client — ${site.nom} – ${site.site}`} />
          </div>
          <Boutons precedent={() => setEtape(4)} suivant={valider} libelleSuivant="Valider et générer le CERFA" occupe={!!enCours} onAbandon={quitter} />
        </div>
      )}

      {etape === 6 && resultat && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm">
            <p className="text-base font-bold text-green-800">CERFA finalisé</p>
            <p className="text-slate-700">
              N° {resultat.numero} — Fiche {resultat.ficheNo}
            </p>
            <a
              href={`/cerfa/${resultat.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-flex items-center gap-1.5 font-semibold text-indigo-700 hover:underline"
            >
              <FileText className="h-4 w-4" /> Ouvrir le PDF
            </a>
            {resultat.avertissement && <p className="mt-2 font-semibold text-amber-800">{resultat.avertissement}</p>}
          </div>
          <div className={CARTE}>
            <p className={TITRE}>Envoi au client</p>
            {envoye ? (
              <p className="text-sm font-semibold text-green-700">Mail envoyé à {emailEnvoi}.</p>
            ) : (
              <>
                <label className={ETIQUETTE} htmlFor="email-envoi">
                  Email destinataire (plusieurs : séparer par une virgule)
                </label>
                <input id="email-envoi" className={CHAMP} value={emailEnvoi} onChange={(e) => setEmailEnvoi(e.target.value)} />
                <button
                  type="button"
                  onClick={envoyer}
                  disabled={!!enCours}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" /> Envoyer le CERFA
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/cerfa/nouveau" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
              Nouveau CERFA
            </Link>
            <button
              type="button"
              onClick={quitter}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              {fermerALaFin ? "Terminer et revenir" : "Terminer"}
            </button>
          </div>
        </div>
      )}

      {ajoutDetecteur && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-base font-bold text-slate-900">Ajouter un détecteur</h2>
            <label className={ETIQUETTE} htmlFor="det-ref">
              Référence
            </label>
            <input id="det-ref" autoFocus className={CHAMP} value={ajoutDetecteur.reference} onChange={(e) => setAjoutDetecteur({ ...ajoutDetecteur, reference: e.target.value })} />
            <label className={`${ETIQUETTE} mt-3`} htmlFor="det-date">
              Date de contrôle
            </label>
            <input id="det-date" type="date" className={CHAMP} value={ajoutDetecteur.date} onChange={(e) => setAjoutDetecteur({ ...ajoutDetecteur, date: e.target.value })} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAjoutDetecteur(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Annuler
              </button>
              <button type="button" onClick={validerAjoutDetecteur} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
