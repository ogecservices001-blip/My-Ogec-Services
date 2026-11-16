import type { SupabaseClient } from "@supabase/supabase-js";
import { ajouterJours } from "@/lib/planning/dates";
import { calculerPointage, horaireAttendu, type LignePointage } from "./pointage";
import { dateArreteParDefaut, finDuMois, moisPrecedent } from "./mois";

export { dateFr, finDuMois } from "./mois";

/// État préparatoire à la saisie des bulletins (feuille « Recap » envoyée à la
/// RH 48 h avant la paie du 24) :
/// - jusqu'à la date d'arrêté : heures, paniers et déplacements réels ;
/// - après : heures et paniers prévus (horaire du jour, sauf absence connue),
///   déplacements à 0 ; le mois suivant, l'écart avec le réel devient une
///   régularisation dans les Observations ;
/// - administratifs et cadres (sans indemnités) : heures prévues moins les
///   absences, sans panier ni déplacement.

export type JourEtat = {
  h: number;
  hs25: number;
  hs50: number;
  hs100: number;
  paniers: number;
  trajet: number;
  transport: number;
  absence: string;
};

export type PeriodeAbsence = { debut: string; fin: string; motif: string; jours: number };

export type LigneEtat = {
  salarieId: string;
  nom: string;
  bloc: "technique" | "autre";
  heures: number;
  hs25: number;
  hs50: number;
  hs100: number;
  paniersNb: number;
  paniersMontant: number;
  trajet: number;
  transport: number;
  absences: PeriodeAbsence[];
  jours: Record<string, JourEtat>;
  resume: string;
};

export type LigneEtatComplete = LigneEtat & {
  regularisation: string;
  observationsAuto: string;
  observations: string;
  modifiee: boolean;
};

export type EtatPreparatoire = {
  mois: string;
  dateArrete: string;
  dateArreteDefaut: string;
  lignes: LigneEtatComplete[];
  cloture: { le: string; par: string } | null;
  moisPrecedent: string;
  regularisationsCalculees: boolean;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

const jj = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const nombreFr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export const eurosFr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const pluriel = (n: number, mot: string) => `${nombreFr(n)} ${mot}${Math.abs(n) > 1 ? "s" : ""}`;

function periodeTexte(dates: string[]): string {
  if (!dates.length) return "";
  const a = dates[0];
  const b = dates[dates.length - 1];
  return a === b ? `le ${jj(a)}` : `du ${jj(a)} au ${jj(b)}`;
}

const enJoursCalendaires = (motif: string) => /maladie|arr[eê]t|accident/i.test(motif);
const estFerie = (motif: string) => /f[ée]ri[ée]/i.test(motif);

export async function calculerEtat(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mois: string,
  dateArrete: string,
): Promise<LigneEtat[]> {
  const d = await calculerPointage(supabase, mois);
  const debut = `${mois}-01`;
  const fin = finDuMois(mois);
  const [{ data: salaries }, { data: absAdmin }] = await Promise.all([
    supabase.from("rh_salaries").select("id, profile_id, nom_paie, categorie, actif, sans_indemnites"),
    supabase.from("rh_absences_admin").select("salarie_id, date_debut, date_fin, rh_motifs_absence(motif)").lte("date_debut", fin).gte("date_fin", debut),
  ]);
  const p = d.parametres;
  const jours: string[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) jours.push(j);
  const attendu = (j: string) => (d.joursFeries.includes(j) ? 0 : horaireAttendu(p, j));

  const lignesJour = new Map<string, LignePointage[]>();
  for (const l of d.lignes) lignesJour.set(`${l.profileId}|${l.date}`, [...(lignesJour.get(`${l.profileId}|${l.date}`) ?? []), l]);

  type Absences = { id: string; date_debut: string; date_fin: string; salarie_id: string; rh_motifs_absence: { motif: string } | null };
  const absences = (absAdmin ?? []) as unknown as Absences[];
  type Sal = { id: string; profileId: string | null; nom: string; bloc: LigneEtat["bloc"] };
  const liste: Sal[] = [];
  const parProfil = new Map<string, Sal>();
  for (const s of (salaries ?? []) as { id: string; profile_id: string | null; nom_paie: string; categorie: string; actif: boolean; sans_indemnites: boolean }[]) {
    const aDesLignes = Boolean(s.profile_id) && d.lignes.some((l) => l.profileId === s.profile_id);
    if (!s.actif && !aDesLignes && !absences.some((a) => a.salarie_id === s.id)) continue;
    const sal: Sal = { id: s.id, profileId: s.profile_id, nom: s.nom_paie, bloc: s.categorie === "technique" && !s.sans_indemnites ? "technique" : "autre" };
    liste.push(sal);
    if (s.profile_id) parProfil.set(s.profile_id, sal);
  }
  for (const l of d.lignes) {
    if (parProfil.has(l.profileId)) continue;
    const sal: Sal = { id: `profil-${l.profileId}`, profileId: l.profileId, nom: l.salarie, bloc: "technique" };
    liste.push(sal);
    parProfil.set(l.profileId, sal);
  }

  const resultat: LigneEtat[] = [];
  for (const sal of liste) {
    const motifJour = new Map<string, string>();
    const heuresAbsence = new Map<string, number>();
    for (const j of jours) {
      for (const l of sal.profileId ? (lignesJour.get(`${sal.profileId}|${j}`) ?? []) : []) {
        if (l.source !== "absence" || estFerie(l.motifAbsence) || d.joursFeries.includes(j)) continue;
        motifJour.set(j, l.motifAbsence || "Absence");
        heuresAbsence.set(j, (heuresAbsence.get(j) ?? 0) + l.heures);
      }
    }
    for (const a of absences.filter((x) => x.salarie_id === sal.id)) {
      const motif = a.rh_motifs_absence?.motif ?? "Absence";
      if (estFerie(motif)) continue;
      for (let j = a.date_debut < debut ? debut : a.date_debut; j <= (a.date_fin > fin ? fin : a.date_fin); j = ajouterJours(j, 1)) {
        if (d.joursFeries.includes(j)) continue;
        motifJour.set(j, motif);
        heuresAbsence.set(j, attendu(j));
      }
    }

    const parJour: Record<string, JourEtat> = {};
    for (const j of jours) {
      const absence = motifJour.get(j) ?? "";
      const att = attendu(j);
      const jr: JourEtat = { h: 0, hs25: 0, hs50: 0, hs100: 0, paniers: 0, trajet: 0, transport: 0, absence };
      if (sal.bloc === "autre") {
        if (!absence) jr.h = att;
      } else if (j <= dateArrete) {
        for (const l of sal.profileId ? (lignesJour.get(`${sal.profileId}|${j}`) ?? []) : []) {
          if (l.source === "absence") continue;
          jr.h += l.hn;
          jr.hs25 += l.hs25;
          jr.hs50 += l.hs50;
          jr.hs100 += l.hs100;
          jr.paniers += l.panierNb;
          jr.trajet += l.trajet;
          jr.transport += l.transport;
        }
      } else if (!absence) {
        jr.h = att;
        jr.paniers = att > p.panier_seuil_heures ? 1 : 0;
      }
      for (const k of ["h", "hs25", "hs50", "hs100", "trajet", "transport"] as const) jr[k] = arrondi(jr[k]);
      parJour[j] = jr;
    }

    const periodes: PeriodeAbsence[] = [];
    for (const j of [...motifJour.keys()].sort()) {
      const motif = motifJour.get(j)!;
      const der = periodes[periodes.length - 1];
      let contigu = Boolean(der) && der.motif === motif;
      if (contigu) for (let x = ajouterJours(der.fin, 1); x < j; x = ajouterJours(x, 1)) if (attendu(x) > 0) contigu = false;
      if (contigu) der.fin = j;
      else periodes.push({ debut: j, fin: j, motif, jours: 0 });
    }
    for (const per of periodes) {
      let n = 0;
      for (let x = per.debut; x <= per.fin; x = ajouterJours(x, 1)) {
        if (enJoursCalendaires(per.motif)) n += 1;
        else if (motifJour.get(x) === per.motif && attendu(x) > 0) n += Math.min(1, Math.round(((heuresAbsence.get(x) ?? 0) / attendu(x)) * 2) / 2);
      }
      per.jours = n;
    }

    const somme = (k: keyof Omit<JourEtat, "absence">) => arrondi(jours.reduce((t, j) => t + parJour[j][k], 0));
    const resume: string[] = [];
    const parMotif = new Map<string, number>();
    for (const per of periodes) parMotif.set(per.motif, (parMotif.get(per.motif) ?? 0) + per.jours);
    for (const [motif, n] of parMotif) resume.push(`${motif} : ${pluriel(n, "jour")}`);
    for (const [k, libelle] of [
      ["hs25", "Heures supplémentaires majorées à 25 %"],
      ["hs50", "Heures supplémentaires majorées à 50 %"],
      ["hs100", "Heures majorées à 100 % (dimanche ou jour férié)"],
    ] as const) {
      const dates = jours.filter((j) => parJour[j][k] > 0);
      if (dates.length) resume.push(`${libelle} : ${nombreFr(somme(k))} h (${dates.map(jj).join(", ")})`);
    }
    const paniersNb = somme("paniers");
    resultat.push({
      salarieId: sal.id,
      nom: sal.nom,
      bloc: sal.bloc,
      heures: somme("h"),
      hs25: somme("hs25"),
      hs50: somme("hs50"),
      hs100: somme("hs100"),
      paniersNb,
      paniersMontant: arrondi(paniersNb * p.panier_montant),
      trajet: somme("trajet"),
      transport: somme("transport"),
      absences: periodes,
      jours: parJour,
      resume: resume.join("\n"),
    });
  }
  resultat.sort((a, b) => (a.bloc === b.bloc ? a.nom.localeCompare(b.nom, "fr") : a.bloc === "technique" ? -1 : 1));
  return resultat;
}

/// Écarts entre ce qui a été déclaré (photo de la clôture) et le réel du mois
/// complet, au format des Observations.
export function regularisations(declare: LigneEtat[], reel: LigneEtat[]): Map<string, string> {
  const textes = new Map<string, string>();
  const vide: JourEtat = { h: 0, hs25: 0, hs50: 0, hs100: 0, paniers: 0, trajet: 0, transport: 0, absence: "" };
  for (const r of reel) {
    const dl = declare.find((x) => x.salarieId === r.salarieId);
    if (!dl) continue;
    const jours = [...new Set([...Object.keys(r.jours), ...Object.keys(dl.jours)])].sort();
    const dj = (j: string) => dl.jours[j] ?? vide;
    const rj = (j: string) => r.jours[j] ?? vide;
    const plus: string[] = [];
    const moins: string[] = [];

    const absenceNouvelle = new Set(jours.filter((j) => rj(j).absence && rj(j).absence !== dj(j).absence));
    const parMotif = new Map<string, string[]>();
    for (const j of absenceNouvelle) parMotif.set(rj(j).absence, [...(parMotif.get(rj(j).absence) ?? []), j]);
    for (const [motif, dates] of parMotif) {
      const h = arrondi(dates.reduce((t, j) => t + dj(j).h - rj(j).h, 0));
      const p = dates.reduce((t, j) => t + dj(j).paniers - rj(j).paniers, 0);
      const parts = [h > 0.01 ? `-${nombreFr(h)} h` : "", p > 0 ? `-${pluriel(p, "panier")}` : ""].filter(Boolean);
      if (parts.length) moins.push(`${motif} ${periodeTexte(dates)} : ${parts.join(", ")}`);
    }

    const autres = jours.filter((j) => !absenceNouvelle.has(j));
    const ecart = (f: (x: JourEtat) => number, libelle: (n: number) => string) => {
      const pos = autres.filter((j) => f(rj(j)) - f(dj(j)) > 0.009);
      const neg = autres.filter((j) => f(rj(j)) - f(dj(j)) < -0.009);
      const total = (dates: string[]) => arrondi(dates.reduce((t, j) => t + f(rj(j)) - f(dj(j)), 0));
      if (pos.length) plus.push(`+${libelle(total(pos))} (${periodeTexte(pos)})`);
      if (neg.length) moins.push(`-${libelle(-total(neg))} (${periodeTexte(neg)})`);
    };
    ecart((x) => x.h, (n) => `${nombreFr(n)} h normales`);
    ecart((x) => x.hs25, (n) => `${nombreFr(n)} h supplémentaires majorées à 25 %`);
    ecart((x) => x.hs50, (n) => `${nombreFr(n)} h supplémentaires majorées à 50 %`);
    ecart((x) => x.hs100, (n) => `${nombreFr(n)} h majorées à 100 %`);
    ecart((x) => x.paniers, (n) => pluriel(n, "panier"));
    ecart((x) => x.trajet + x.transport, (n) => `${eurosFr(n)} de déplacements`);

    if (!plus.length && !moins.length) continue;
    const lignes = ["Régularisation à effectuer :"];
    if (plus.length) lignes.push("À rajouter :", ...plus);
    if (moins.length) lignes.push("À déduire :", ...moins);
    textes.set(r.salarieId, lignes.join("\n"));
  }
  return textes;
}

export async function chargerEtatPreparatoire(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mois: string,
): Promise<EtatPreparatoire> {
  const precedent = moisPrecedent(mois);
  const [{ data: param }, { data: cloture }, { data: brouillon }, { data: cloturePrecedente }] = await Promise.all([
    supabase.from("rh_parametres").select("jour_arrete").eq("id", 1).single(),
    supabase.from("rh_clotures").select("cloture_le, cloture_par, date_arrete, etat").eq("mois", mois).maybeSingle(),
    supabase.from("rh_etats_preparatoires").select("date_arrete, observations").eq("mois", mois).maybeSingle(),
    supabase.from("rh_clotures").select("etat").eq("mois", precedent).maybeSingle(),
  ]);
  const dateArreteDefaut = dateArreteParDefaut(mois, Number(param?.jour_arrete ?? 22));
  const regularisationsCalculees = Boolean(cloturePrecedente?.etat);

  if (cloture?.etat) {
    return {
      mois,
      dateArrete: cloture.date_arrete ?? finDuMois(mois),
      dateArreteDefaut,
      lignes: cloture.etat as LigneEtatComplete[],
      cloture: { le: cloture.cloture_le, par: cloture.cloture_par },
      moisPrecedent: precedent,
      regularisationsCalculees,
    };
  }

  const dateArrete = brouillon?.date_arrete ?? dateArreteDefaut;
  const [lignes, regul] = await Promise.all([
    calculerEtat(supabase, mois, dateArrete),
    cloturePrecedente?.etat
      ? calculerEtat(supabase, precedent, finDuMois(precedent)).then((reel) => regularisations(cloturePrecedente.etat as LigneEtat[], reel))
      : Promise.resolve(new Map<string, string>()),
  ]);
  const saisies = (brouillon?.observations ?? {}) as Record<string, string>;
  return {
    mois,
    dateArrete,
    dateArreteDefaut,
    lignes: lignes.map((l) => {
      const regularisation = regul.get(l.salarieId) ?? "";
      const observationsAuto = [regularisation, l.resume].filter(Boolean).join("\n\n");
      const modifiee = typeof saisies[l.salarieId] === "string";
      return { ...l, regularisation, observationsAuto, observations: modifiee ? saisies[l.salarieId] : observationsAuto, modifiee };
    }),
    cloture: cloture ? { le: cloture.cloture_le, par: cloture.cloture_par } : null,
    moisPrecedent: precedent,
    regularisationsCalculees,
  };
}
