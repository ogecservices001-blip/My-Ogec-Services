"use client";

import { ListeRecherche } from "@/components/liste-recherche";
import { ListeMultiRecherche } from "@/components/liste-multi-recherche";
import { ChoixClientSite } from "@/components/choix-client-site";
import { useChampManquant } from "@/components/champ-manquant";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, Mail, X } from "lucide-react";
import {
  chargerEmailSite,
  chargerInfoVisiteSite,
  chercherConflitsAbsence,
  creerCreneaux,
  envoyerMailPlanning,
  modifierCreneau,
  verifierQuotaJours,
  type ConflitAbsence,
  type InfoVisiteSite,
  type PosteHorsClientOption,
} from "./actions";
import type { DevisARealiser } from "@/app/(app)/bi/nouveau/actions";
import type { CreneauAffiche } from "./creneau-carte";
import { formaterJourLong } from "@/lib/planning/dates";
import { formaterHeures, joursDeLaPeriode, journeeType, proposerVisiteSuivante } from "@/lib/planning/periode";

type SiteOption = { id: string; nom: string; site: string; hors_contrat: boolean };
type TechnicienOption = { id: string; name: string };
type Onglet = "sous_contrat" | "prestation" | "hors_client";
type Visite = { numero: number; total: number; annee: number };

export type CreneauAModifier = CreneauAffiche & {
  site_id: string | null;
  devis_id: string | null;
  visite_numero?: number | null;
  visite_total?: number | null;
  visite_annee?: number | null;
};

const CHAMP =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 sm:py-2 sm:text-sm";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

const dateFr = (d: string) => d.split("-").reverse().join("/");

export function NouveauCreneauForm({
  sites,
  techniciens,
  postesHorsClient,
  devisARealiser,
  joursFeries,
  dateInitiale,
  technicienInitialId,
  creneauAModifier,
  techniciensDuCreneau,
  onFerme,
  onVoirCreneau,
}: {
  sites: SiteOption[];
  techniciens: TechnicienOption[];
  postesHorsClient: PosteHorsClientOption[];
  devisARealiser: DevisARealiser[];
  joursFeries: string[];
  dateInitiale?: string;
  technicienInitialId?: string;
  creneauAModifier?: CreneauAModifier;
  techniciensDuCreneau?: string[];
  onFerme: () => void;
  onVoirCreneau: (id: string, date: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { signaler, fenetre } = useChampManquant();
  const modification = Boolean(creneauAModifier);

  const [onglet, setOnglet] = useState<Onglet>(
    creneauAModifier?.poste_hors_client_id ? "hors_client" : creneauAModifier?.devis_id ? "prestation" : "sous_contrat",
  );
  const [clientNom, setClientNom] = useState(creneauAModifier?.client_nom ?? "");
  const [siteId, setSiteId] = useState(creneauAModifier?.site_id ?? "");
  const [devisId, setDevisId] = useState(creneauAModifier?.devis_id ?? "");
  const [posteId, setPosteId] = useState(creneauAModifier?.poste_hors_client_id ?? "");
  const [technicienIds, setTechnicienIds] = useState<string[]>(
    techniciensDuCreneau ?? (technicienInitialId ? [technicienInitialId] : []),
  );
  const [dateDebut, setDateDebut] = useState(creneauAModifier?.date ?? dateInitiale ?? "");
  const [dateFin, setDateFin] = useState(creneauAModifier?.date ?? dateInitiale ?? "");
  const [heuresSaisies, setHeuresSaisies] = useState<Record<string, string>>(
    creneauAModifier ? { [creneauAModifier.date]: String(creneauAModifier.heures_prevues) } : {},
  );
  const [heureDebut, setHeureDebut] = useState(creneauAModifier?.heure_debut ?? "");
  const [observations, setObservations] = useState(creneauAModifier?.observations ?? "");

  const [visite, setVisite] = useState<Visite | null>(
    creneauAModifier?.visite_numero && creneauAModifier.visite_total && creneauAModifier.visite_annee
      ? { numero: creneauAModifier.visite_numero, total: creneauAModifier.visite_total, annee: creneauAModifier.visite_annee }
      : null,
  );
  const [infoBrut, setInfoBrut] = useState<{ cle: string; data: InfoVisiteSite | null } | null>(null);

  const [erreur, setErreur] = useState<string | null>(null);
  const [alertesQuota, setAlertesQuota] = useState<string[] | null>(null);
  const [conflits, setConflits] = useState<ConflitAbsence[] | null>(null);

  const [enregistre, setEnregistre] = useState<{
    ids: string[];
    jours: { date: string; heures: number }[];
    visite: Visite | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [envoi, startEnvoi] = useTransition();
  const [mailEnvoye, setMailEnvoye] = useState(false);
  const [erreurMail, setErreurMail] = useState<string | null>(null);

  const sitesSousContrat = useMemo(
    () => sites.filter((s) => !s.hors_contrat || s.id === creneauAModifier?.site_id),
    [sites, creneauAModifier?.site_id],
  );
  const poste = postesHorsClient.find((p) => p.id === posteId);
  const estAbsence = onglet === "hors_client" && poste?.client.trim().toLowerCase() === "absence";

  const jours = useMemo(() => {
    const base = modification
      ? dateDebut
        ? [{ date: dateDebut, heures: journeeType(dateDebut) }]
        : []
      : joursDeLaPeriode(dateDebut, dateFin, joursFeries, onglet === "hors_client");
    return base.map((j) => {
      const saisie = heuresSaisies[j.date];
      const n = saisie === undefined ? j.heures : parseFloat(saisie.replace(",", "."));
      return { date: j.date, heures: Number.isFinite(n) ? n : 0 };
    });
  }, [modification, dateDebut, dateFin, joursFeries, onglet, heuresSaisies]);

  const heuresParTechnicien = jours.reduce((t, j) => t + j.heures, 0);
  const heuresTotal = heuresParTechnicien * Math.max(1, technicienIds.length);
  const dateInterditeEnModif =
    modification && onglet !== "hors_client" && !!dateDebut && joursDeLaPeriode(dateDebut, dateDebut, joursFeries).length === 0;

  const anneeVisite =
    visite && visite.annee >= 2000 && visite.annee <= 2100
      ? visite.annee
      : dateDebut
        ? Number(dateDebut.slice(0, 4))
        : new Date().getFullYear();

  const cleInfo = onglet === "sous_contrat" && siteId ? `${siteId}|${anneeVisite}` : "";
  const info = infoBrut && infoBrut.cle === cleInfo ? infoBrut.data : null;
  const chargementInfo = cleInfo !== "" && infoBrut?.cle !== cleInfo;

  useEffect(() => {
    if (!cleInfo) return;
    let annule = false;
    chargerInfoVisiteSite(siteId, anneeVisite, creneauAModifier ? [creneauAModifier.id] : []).then((res) => {
      if (annule) return;
      setInfoBrut({ cle: cleInfo, data: res });
      if (res) {
        setVisite((v) =>
          v && v.annee === res.annee
            ? { ...v, total: v.total || res.frequence }
            : { numero: res.prochaine ?? res.frequence, total: res.frequence, annee: res.annee },
        );
      }
    });
    return () => {
      annule = true;
    };
  }, [cleInfo, siteId, anneeVisite, creneauAModifier]);

  const visiteInfo = info && visite ? info.visites.find((v) => v.numero === visite.numero) : undefined;
  const resteAvant = info && visiteInfo ? Math.max(0, visiteInfo.heures.total - visiteInfo.programmees) : null;

  function changerOnglet(o: Onglet) {
    setOnglet(o);
    setClientNom("");
    setSiteId("");
    setDevisId("");
    setPosteId("");
    setVisite(null);
    setConflits(null);
    setAlertesQuota(null);
  }

  function changerHeures(date: string, valeur: string) {
    setHeuresSaisies((h) => ({ ...h, [date]: valeur }));
    setAlertesQuota(null);
  }

  function construireBase() {
    const site = sites.find((s) => s.id === siteId);
    const intervention = onglet !== "hors_client";
    return {
      site_id: intervention ? siteId || null : null,
      devis_id: onglet === "prestation" ? devisId || null : null,
      poste_hors_client_id: onglet === "hors_client" ? posteId || null : null,
      client_nom: intervention ? clientNom : (poste?.client ?? ""),
      site: intervention ? (site?.site ?? "") : (poste?.site ?? ""),
      heure_debut: heureDebut ? heureDebut.slice(0, 5) : null,
      observations,
      technicien_ids: technicienIds,
      visite_numero: onglet === "sous_contrat" ? (visite?.numero ?? null) : null,
      visite_total: onglet === "sous_contrat" ? (visite?.total ?? null) : null,
      visite_annee: onglet === "sous_contrat" ? (visite?.annee ?? null) : null,
    };
  }

  async function soumettre() {
    setErreur(null);
    if (onglet === "prestation" && !devisId) return signaler("Choisis la prestation sur commande", "planning-prestation");
    if (onglet === "sous_contrat" && !clientNom) return signaler("Choisis le client", "planning-client");
    if (onglet === "sous_contrat" && !siteId) return signaler("Choisis le site", "planning-site");
    if (onglet === "hors_client" && !posteId) return signaler("Choisis le poste hors client", "planning-poste");
    if (onglet === "sous_contrat") {
      if (!visite || !(visite.numero >= 1) || !(visite.total >= 1) || visite.total > 12)
        return signaler("Renseigne la visite (n° et nombre de visites par an, 12 au plus)", "planning-visite-numero");
      if (visite.numero > visite.total)
        return signaler(`La visite ${visite.numero} dépasse le nombre de visites par an (${visite.total})`, "planning-visite-numero");
      if (!(visite.annee >= 2000 && visite.annee <= 2100)) return signaler("Renseigne l'année de la visite", "planning-visite-annee");
    }
    if (technicienIds.length === 0) return signaler("Choisis au moins un technicien", "planning-techniciens");
    if (!dateDebut) return signaler("Renseigne la date", "planning-date");
    if (!modification && dateFin && dateFin < dateDebut) return signaler("La date de fin est avant la date de début", "planning-date-fin");
    if (dateInterditeEnModif) return signaler("Impossible de planifier une intervention client un week-end ou un jour férié", "planning-date");
    if (jours.length === 0)
      return signaler(
        onglet === "hors_client" ? "Aucun jour de semaine dans la période" : "Aucun jour ouvré dans la période (week-ends et jours fériés exclus)",
        "planning-date",
      );
    const jourSansHeure = jours.find((j) => !(j.heures > 0));
    if (jourSansHeure) return signaler(`Heures du ${dateFr(jourSansHeure.date)} à renseigner`, `planning-heures-${jourSansHeure.date}`);

    if (estAbsence && conflits === null) {
      const trouves = await chercherConflitsAbsence(technicienIds, jours.map((j) => j.date));
      const autres = trouves.filter((c) => c.id !== creneauAModifier?.id);
      if (autres.length > 0) {
        setConflits(autres);
        return;
      }
    }
    if (alertesQuota === null) {
      const alertes = await verifierQuotaJours(technicienIds, jours, creneauAModifier?.id);
      if (alertes.length > 0) {
        setAlertesQuota(alertes);
        return;
      }
    }

    startTransition(async () => {
      const base = construireBase();
      let ids: string[] = [];
      if (creneauAModifier) {
        const res = await modifierCreneau(creneauAModifier.id, { ...base, date: jours[0].date, heures_prevues: jours[0].heures });
        if (!res.ok) return setErreur(res.erreur);
        ids = [creneauAModifier.id];
      } else {
        const res = await creerCreneaux(base, jours);
        if (!res.ok) return setErreur(res.erreur);
        ids = res.ids;
      }
      router.refresh();
      if (onglet === "hors_client") return onFerme();
      setEnregistre({ ids, jours, visite: onglet === "sous_contrat" ? visite : null });
      setMailEnvoye(false);
      setErreurMail(null);
      setEmail(info?.email || (siteId ? await chargerEmailSite(siteId) : ""));
    });
  }

  const suivante =
    enregistre?.visite && !modification
      ? proposerVisiteSuivante(enregistre.visite, enregistre.jours[0].date, enregistre.jours.length, joursFeries)
      : null;

  function planifierSuivante() {
    if (!suivante) return;
    setVisite(suivante.visite);
    setDateDebut(suivante.debut);
    setDateFin(suivante.fin);
    setHeuresSaisies({});
    setObservations("");
    setAlertesQuota(null);
    setConflits(null);
    setEnregistre(null);
  }

  function envoyerMail() {
    if (!enregistre) return;
    setErreurMail(null);
    startEnvoi(async () => {
      const res = await envoyerMailPlanning(enregistre.ids, email);
      if (!res.ok) setErreurMail(res.erreur);
      else setMailEnvoye(true);
    });
  }

  function champVisite(cle: keyof Visite, valeur: string) {
    setVisite((v) => ({ ...(v ?? { numero: 1, total: 1, annee: anneeVisite }), [cle]: Number(valeur) }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {enregistre ? "Créneau enregistré" : modification ? "Modifier le créneau" : "Nouveau créneau"}
          </h2>
          <button onClick={onFerme} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {fenetre}

        {enregistre ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
              <div className="text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {enregistre.ids.length} créneau{enregistre.ids.length > 1 ? "x" : ""} enregistré{enregistre.ids.length > 1 ? "s" : ""} —{" "}
                  {clientNom}
                </p>
                <p>{enregistre.jours.map((j) => dateFr(j.date)).join(", ")}</p>
                {enregistre.visite && (
                  <p>
                    Visite {enregistre.visite.numero} de {enregistre.visite.total} — {enregistre.visite.annee}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Mail className="h-4 w-4" strokeWidth={2.25} />
                Prévenir le client par mail
              </p>
              <p className="mb-2 text-xs text-slate-500">Le mail donne le site et les dates de passage, sans les noms des techniciens.</p>
              {mailEnvoye ? (
                <p className="text-sm font-semibold text-brand-green-dark">Mail envoyé à {email}.</p>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="planning-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email du client"
                    className={CHAMP}
                  />
                  <button
                    onClick={() => (email.trim() ? envoyerMail() : signaler("Renseigne l'email du client", "planning-email"))}
                    disabled={envoi}
                    className="shrink-0 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
                  >
                    {envoi ? "Envoi..." : "Envoyer le mail"}
                  </button>
                </div>
              )}
              {erreurMail && <p className="mt-2 text-xs text-red-600">{erreurMail}</p>}
            </div>

            {suivante && (
              <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <CalendarClock className="h-4 w-4" strokeWidth={2.25} />
                  Planifier la visite suivante ?
                </p>
                <p className="mb-3 text-sm text-slate-700">
                  Visite {suivante.visite.numero} de {suivante.visite.total} — {suivante.visite.annee}, vers le{" "}
                  <strong>
                    {formaterJourLong(suivante.debut)} {suivante.debut.slice(0, 4)}
                  </strong>
                  {suivante.fin !== suivante.debut && (
                    <>
                      {" "}
                      au {formaterJourLong(suivante.fin)} {suivante.fin.slice(0, 4)}
                    </>
                  )}
                  .
                </p>
                <button
                  onClick={planifierSuivante}
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark"
                >
                  Oui, planifier la visite suivante
                </button>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={onFerme} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                {suivante ? "Non, terminer" : "Fermer"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

            <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
              {(
                [
                  { v: "sous_contrat", l: "Sous contrat" },
                  { v: "prestation", l: "Prestation sur commande" },
                  { v: "hors_client", l: "Poste hors client" },
                ] as { v: Onglet; l: string }[]
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => changerOnglet(o.v)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
                    onglet === o.v
                      ? o.v === "hors_client"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-brand-green text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4">
                {onglet === "sous_contrat" && (
                  <>
                    <ChoixClientSite
                      sites={sitesSousContrat}
                      clientNom={clientNom}
                      siteId={siteId}
                      idClient="planning-client"
                      idSite="planning-site"
                      onChange={(choix) => {
                        setClientNom(choix.clientNom);
                        if (choix.siteId !== siteId) {
                          setSiteId(choix.siteId);
                          setVisite(null);
                        }
                      }}
                    />
                    {siteId && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Visite d&apos;entretien</p>
                        {chargementInfo && !info ? (
                          <p className="text-sm text-slate-400">Calcul…</p>
                        ) : (
                          <>
                            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                              Visite
                              <input
                                id="planning-visite-numero"
                                type="number"
                                min={1}
                                max={12}
                                value={visite?.numero || ""}
                                onChange={(e) => champVisite("numero", e.target.value)}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center"
                              />
                              de
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={visite?.total || ""}
                                onChange={(e) => champVisite("total", e.target.value)}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center"
                              />
                              —
                              <input
                                id="planning-visite-annee"
                                type="number"
                                min={2000}
                                max={2100}
                                value={visite?.annee || ""}
                                onChange={(e) => champVisite("annee", e.target.value)}
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center"
                              />
                            </div>
                            {info && (
                              <div className="space-y-1 text-sm">
                                {info.prochaine === null && (
                                  <p className="font-semibold text-amber-700">Toutes les visites {info.annee} sont faites ou planifiées.</p>
                                )}
                                {visiteInfo && (
                                  <p className="text-slate-700">
                                    Visite {visiteInfo.numero} de {info.frequence} : {formaterHeures(visiteInfo.heures.tech)} tech +{" "}
                                    {formaterHeures(visiteInfo.heures.assistant)} assistant ={" "}
                                    <strong>{formaterHeures(visiteInfo.heures.total)}</strong>
                                  </p>
                                )}
                                <p className="text-xs text-slate-400">
                                  Calculé sur {info.equipementsCalcules} équipement{info.equipementsCalcules > 1 ? "s" : ""} sous contrat (Référentiel
                                  Heures) · heures vendues au contrat : {formaterHeures(info.heuresContrat)} / an
                                </p>
                                {info.equipementsSansHeures > 0 && (
                                  <p className="text-xs text-amber-700">
                                    {info.equipementsSansHeures} équipement{info.equipementsSansHeures > 1 ? "s" : ""} sans heures (fréquence ou référence
                                    manquante dans la GMAO).
                                  </p>
                                )}
                                {visiteInfo?.faite && <p className="font-semibold text-amber-700">Cette visite est déjà faite (BI validé).</p>}
                                {visiteInfo && visiteInfo.programmees > 0 && (
                                  <p className="text-slate-600">Déjà programmé pour cette visite : {formaterHeures(visiteInfo.programmees)}</p>
                                )}
                                {resteAvant !== null && (
                                  <p className="text-base font-bold text-slate-900">
                                    Heures à planifier : {formaterHeures(resteAvant)}
                                    {heuresTotal > 0 && (
                                      <span
                                        className={`ml-2 text-sm font-semibold ${
                                          resteAvant - heuresTotal < -0.01 ? "text-amber-600" : "text-brand-green-dark"
                                        }`}
                                      >
                                        → reste {formaterHeures(resteAvant - heuresTotal)} après ce créneau
                                      </span>
                                    )}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {info.visites.map((v) => (
                                    <span
                                      key={v.numero}
                                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        v.faite
                                          ? "bg-slate-200 text-slate-600"
                                          : v.programmees > 0 && v.programmees >= v.heures.total - 0.01
                                            ? "bg-brand-green/15 text-brand-green-dark"
                                            : v.programmees > 0
                                              ? "bg-amber-100 text-amber-700"
                                              : "bg-white text-slate-500 ring-1 ring-slate-200"
                                      }`}
                                    >
                                      V{v.numero}{" "}
                                      {v.faite
                                        ? "faite"
                                        : `${v.programmees > 0 ? `${formaterHeures(v.programmees)} / ` : ""}${formaterHeures(v.heures.total)}`}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {onglet === "prestation" && (
                  <div>
                    <label className={ETIQUETTE}>Prestation sur commande (devis à réaliser)</label>
                    <ListeRecherche
                      id="planning-prestation"
                      valeur={devisId}
                      onChange={(id) => {
                        const d = devisARealiser.find((x) => x.id === id);
                        setDevisId(id);
                        setClientNom(d?.client_nom ?? "");
                        setSiteId(d?.site_id ?? "");
                      }}
                      placeholder="Tape un client, un site ou un n° de devis"
                      vide="Aucune prestation à réaliser"
                      options={devisARealiser.map((d) => ({
                        valeur: d.id,
                        label: `${d.numero || "(sans référence)"} — ${d.client_nom} — ${d.client_site}`,
                        detail: d.libelle ? d.libelle.slice(0, 50) : undefined,
                      }))}
                    />
                  </div>
                )}

                {onglet === "hors_client" && (
                  <div>
                    <label className={ETIQUETTE}>Poste hors client</label>
                    <ListeRecherche
                      id="planning-poste"
                      valeur={posteId}
                      onChange={(id) => {
                        setPosteId(id);
                        setConflits(null);
                      }}
                      placeholder="Tape pour chercher le poste"
                      vide="Aucun poste trouvé"
                      options={postesHorsClient.map((p) => ({ valeur: p.id, label: p.client, detail: p.site || undefined }))}
                    />
                  </div>
                )}

                <div>
                  <label className={ETIQUETTE}>Observations</label>
                  <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} className={CHAMP} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={ETIQUETTE}>Technicien(s)</label>
                  <ListeMultiRecherche
                    id="planning-techniciens"
                    valeurs={technicienIds}
                    onChange={(v) => {
                      setTechnicienIds(v);
                      setConflits(null);
                      setAlertesQuota(null);
                    }}
                    placeholder="Tape pour chercher un technicien"
                    vide="Aucun technicien trouvé"
                    options={techniciens.map((t) => ({ valeur: t.id, label: t.name }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={ETIQUETTE}>{modification ? "Date" : "Du"}</label>
                    <input
                      id="planning-date"
                      type="date"
                      value={dateDebut}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDateDebut(v);
                        if (!dateFin || dateFin < v || modification) setDateFin(v);
                        setConflits(null);
                        setAlertesQuota(null);
                      }}
                      className={CHAMP}
                    />
                  </div>
                  {modification ? (
                    <div>
                      <label className={ETIQUETTE}>Heure de début (optionnel)</label>
                      <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className={CHAMP} />
                    </div>
                  ) : (
                    <div>
                      <label className={ETIQUETTE}>Au (inclus)</label>
                      <input
                        id="planning-date-fin"
                        type="date"
                        value={dateFin}
                        min={dateDebut || undefined}
                        onChange={(e) => {
                          setDateFin(e.target.value);
                          setConflits(null);
                          setAlertesQuota(null);
                        }}
                        className={CHAMP}
                      />
                    </div>
                  )}
                </div>
                {!modification && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={ETIQUETTE}>Heure de début (optionnel)</label>
                      <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className={CHAMP} />
                    </div>
                  </div>
                )}
                {dateInterditeEnModif && (
                  <p className="text-xs font-semibold text-red-600">Week-end ou jour férié : impossible pour une intervention client.</p>
                )}

                {jours.length > 0 && (
                  <div className="rounded-xl border border-slate-200">
                    <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                      {jours.map((j) => (
                        <div key={j.date} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                          <span className="text-slate-700">
                            {formaterJourLong(j.date)}
                            {joursFeries.includes(j.date) && <span className="ml-1 text-xs font-semibold text-red-600">férié</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <input
                              id={`planning-heures-${j.date}`}
                              type="number"
                              step="0.5"
                              min="0"
                              value={heuresSaisies[j.date] ?? String(j.heures)}
                              onChange={(e) => changerHeures(j.date, e.target.value)}
                              className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm"
                            />
                            <span className="text-xs text-slate-400">h</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <p className="text-slate-600">
                        {jours.length} jour{jours.length > 1 ? "s" : ""} · {formaterHeures(heuresParTechnicien)} par technicien
                      </p>
                      <p className="font-bold text-slate-900">
                        Heures prévues : {formaterHeures(heuresTotal)}
                        {technicienIds.length > 1 && <span className="font-normal text-slate-500"> ({technicienIds.length} techniciens)</span>}
                      </p>
                    </div>
                  </div>
                )}
                {!modification && onglet !== "hors_client" && dateDebut && (
                  <p className="text-xs text-slate-400">Les week-ends et jours fériés sont retirés automatiquement.</p>
                )}
              </div>
            </div>

            {conflits && conflits.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
                  Déjà programmé sur un site ces jours-là
                </p>
                <ul className="mb-3 space-y-1.5">
                  {conflits.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
                      <span>
                        {dateFr(c.date)} — {c.client_nom} — {c.site} ({c.techniciens.join(", ")})
                      </span>
                      <button
                        type="button"
                        onClick={() => onVoirCreneau(c.id, c.date)}
                        className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
                      >
                        Aller au créneau
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-800">L&apos;absence peut être enregistrée quand même ; ces créneaux restent à replanifier.</p>
              </div>
            )}

            {alertesQuota && alertesQuota.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {alertesQuota.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
                <p className="mt-1 font-semibold">Continuer quand même ?</p>
              </div>
            )}

            <button
              onClick={soumettre}
              disabled={pending}
              className="mt-5 w-full rounded-xl bg-brand-green px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-green-dark disabled:opacity-50"
            >
              {pending
                ? "Enregistrement..."
                : conflits?.length || alertesQuota?.length
                  ? "Enregistrer quand même"
                  : modification
                    ? "Enregistrer les modifications"
                    : jours.length > 1
                      ? `Enregistrer les ${jours.length} jours`
                      : "Enregistrer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
