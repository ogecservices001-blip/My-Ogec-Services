import type { SupabaseClient } from "@supabase/supabase-js";
import { dureeEnHeures } from "@/lib/bi/format";
import { Poles } from "@/lib/bi/constants";
import { ajouterJours, jourSemaineUTC, lundiDeLaSemaine } from "@/lib/planning/dates";
import { cleIntervention, creneauxDesInterventions, type CreneauIntervention } from "@/lib/planning/intervention";
import { normaliserCle } from "./referentiels";

/// Pointage mensuel, port de la macro C_ExtractionHeures (et D_PrimeTransport) :
/// - source : créneaux du planning ; si l'intervention a un BI, son temps passé
///   réel (total ÷ nombre de techniciens du BI) remplace les heures prévues,
///   réparti au prorata des heures prévues de chaque jour ; + les BI de
///   dépannage, qui ne sont pas au planning ;
/// - dimanche ou jour férié : 100 % ; absence : heures normales ;
/// - semaine : normales jusqu'à la durée légale, puis 25 % jusqu'au plafond,
///   puis 50 % ;
/// - panier : un par jour, quand le travail de la journée dépasse le seuil ;
/// - trajet : un par jour, le plus élevé ; transport : idem, si véhicule
///   personnel coché pour la journée.

export type LignePointage = {
  cle: string;
  date: string;
  mois: number;
  semaine: number;
  profileId: string;
  salarie: string;
  client: string;
  site: string;
  nAffaire: string;
  pole: string;
  commune: string;
  communeConnue: boolean;
  source: "planning" | "bi" | "depannage" | "absence" | "poste";
  libelleSource: string;
  heures: number;
  hn: number;
  hs25: number;
  hs50: number;
  hs100: number;
  panierNb: number;
  panierMontant: number;
  trajet: number;
  transport: number;
  vehiculePerso: boolean;
  motifAbsence: string;
  lien: string;
};

export type ParametresRh = {
  duree_legale_hebdo: number;
  plafond_hs25_hebdo: number;
  panier_montant: number;
  panier_seuil_heures: number;
  horaire_lundi: number;
  horaire_mardi: number;
  horaire_mercredi: number;
  horaire_jeudi: number;
  horaire_vendredi: number;
};

export function horaireAttendu(p: ParametresRh, dateISO: string): number {
  return [0, p.horaire_lundi, p.horaire_mardi, p.horaire_mercredi, p.horaire_jeudi, p.horaire_vendredi, 0][jourSemaineUTC(dateISO)] ?? 0;
}

export function numeroSemaineIso(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - premierJeudi.getTime()) / 86400000 - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
}

const arrondi = (n: number) => Math.round(n * 100) / 100;
const isoDepuisFr = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

type Brute = Omit<LignePointage, "hn" | "hs25" | "hs50" | "hs100" | "panierNb" | "panierMontant" | "trajet" | "transport" | "vehiculePerso" | "mois" | "semaine"> & {
  exclusPanier: boolean;
  ordre: number;
};

export type DonneesPointage = {
  lignes: LignePointage[];
  parametres: ParametresRh;
  joursFeries: string[];
  techniciens: { id: string; name: string; salarie: string | null }[];
  sitesSansCommune: { id: string; nom: string; site: string }[];
  communesHorsBareme: { commune: string; nb: number }[];
};

export async function calculerPointage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mois: string,
): Promise<DonneesPointage> {
  const [an, m] = mois.split("-").map(Number);
  const debutMois = `${mois}-01`;
  const finMois = new Date(Date.UTC(an, m, 0)).toISOString().slice(0, 10);
  // Semaines complètes : le cumul hebdomadaire démarre au lundi de la 1re semaine.
  const debut = lundiDeLaSemaine(debutMois);

  const [{ data: param }, { data: bareme }, { data: salaries }, { data: motifs }, { data: feries }, { data: profils }, { data: postes }] = await Promise.all([
    supabase.from("rh_parametres").select("*").eq("id", 1).single(),
    supabase.from("rh_bareme_communes").select("commune, prime_trajet, prime_transport"),
    supabase.from("rh_salaries").select("profile_id, nom_paie, actif"),
    supabase.from("rh_motifs_absence").select("motif, poste_hors_client_id, exclu_panier"),
    supabase.from("jours_feries").select("date").gte("date", debut).lte("date", finMois),
    supabase.from("profiles").select("id, name, role"),
    supabase.from("postes_hors_client").select("id, client, site"),
  ]);
  const parametres = param as ParametresRh;
  const joursFeries = (feries ?? []).map((f: { date: string }) => f.date);
  const tarif = new Map(((bareme ?? []) as { commune: string; prime_trajet: number; prime_transport: number }[]).map((b) => [normaliserCle(b.commune), b]));
  const salarieParProfil = new Map(((salaries ?? []) as { profile_id: string | null; nom_paie: string }[]).filter((s) => s.profile_id).map((s) => [s.profile_id as string, s.nom_paie]));
  const profilParId = new Map(((profils ?? []) as { id: string; name: string; role: string }[]).map((p) => [p.id, p]));
  const profilParNom = new Map(((profils ?? []) as { id: string; name: string }[]).map((p) => [p.name.trim().toLowerCase(), p.id]));
  const motifParPoste = new Map(((motifs ?? []) as { motif: string; poste_hors_client_id: string | null; exclu_panier: boolean }[]).filter((x) => x.poste_hors_client_id).map((x) => [x.poste_hors_client_id as string, x]));
  const posteParId = new Map(((postes ?? []) as { id: string; client: string; site: string }[]).map((p) => [p.id, p]));

  // ---- Créneaux et BI
  const { data: creneaux } = await supabase
    .from("creneaux_planning")
    .select("id, date, site_id, devis_id, poste_hors_client_id, visite_numero, visite_annee, client_nom, site, heures_prevues, creneau_techniciens(technicien_id)")
    .eq("annule", false)
    .gte("date", debut)
    .lte("date", finMois);
  type Creneau = CreneauIntervention & {
    poste_hors_client_id: string | null;
    client_nom: string;
    site: string;
    heures_prevues: number;
    creneau_techniciens: { technicien_id: string }[] | null;
  };
  const liste = (creneaux ?? []) as Creneau[];
  const groupes = await creneauxDesInterventions(supabase, liste.filter((c) => c.site_id));
  const idsGroupes = groupes.map((c) => c.id);
  const [{ data: bisLies }, { data: bisDepannage }, { data: sites }, { data: devis }] = await Promise.all([
    idsGroupes.length
      ? supabase.from("bons_intervention").select("id, numero, creneau_id, temps_passe, techniciens, statut").in("creneau_id", idsGroupes).neq("statut", "brouillon")
      : Promise.resolve({ data: [] }),
    supabase
      .from("bons_intervention")
      .select("id, numero, site_id, client_nom, site, temps_passe, techniciens, date_intervention, date_debut, creneau_id")
      .eq("pole", Poles.depannage)
      .neq("statut", "brouillon")
      .is("creneau_id", null),
    supabase.from("sites").select("id, nom, site, n_affaire, commune"),
    supabase.from("devis").select("id, numero, nature"),
  ]);
  const siteParId = new Map(((sites ?? []) as { id: string; nom: string; site: string; n_affaire: string; commune: string }[]).map((s) => [s.id, s]));
  const devisParId = new Map(((devis ?? []) as { id: string; numero: string; nature: string }[]).map((d) => [d.id, d]));

  // Temps réel par technicien et par intervention (BI lié à un créneau du groupe).
  const groupeParCreneau = new Map(groupes.map((c) => [c.id, cleIntervention(c)]));
  const reelParGroupe = new Map<string, { parTech: number; bi: { id: string; numero: string }; techs: Set<string> }>();
  for (const b of (bisLies ?? []) as { id: string; numero: string; creneau_id: string; temps_passe: string; techniciens: string[] }[]) {
    const cle = groupeParCreneau.get(b.creneau_id);
    const total = dureeEnHeures(b.temps_passe ?? "");
    if (!cle || total === null) continue;
    const techs = (b.techniciens ?? []).map((n) => profilParNom.get(n.trim().toLowerCase())).filter((x): x is string => Boolean(x));
    reelParGroupe.set(cle, { parTech: total / Math.max(1, (b.techniciens ?? []).length), bi: { id: b.id, numero: b.numero }, techs: new Set(techs) });
  }
  // Heures prévues par (groupe, technicien), pour répartir le temps réel.
  const prevuParGroupeTech = new Map<string, number>();
  for (const c of liste) {
    const cle = c.site_id ? cleIntervention(c) : "";
    if (!cle || !reelParGroupe.has(cle)) continue;
    for (const t of c.creneau_techniciens ?? []) {
      const k = `${cle}|${t.technicien_id}`;
      prevuParGroupeTech.set(k, (prevuParGroupeTech.get(k) ?? 0) + Number(c.heures_prevues));
    }
  }

  const brutes: Brute[] = [];
  let ordre = 0;
  for (const c of liste) {
    for (const t of c.creneau_techniciens ?? []) {
      const prof = profilParId.get(t.technicien_id);
      if (!prof) continue;
      const base = {
        cle: `${c.id}-${t.technicien_id}`,
        date: c.date,
        profileId: t.technicien_id,
        salarie: salarieParProfil.get(t.technicien_id) ?? prof.name,
        ordre: ordre++,
        lien: `/planning?semaine=${lundiDeLaSemaine(c.date)}&creneau=${c.id}`,
      };
      if (c.poste_hors_client_id) {
        const poste = posteParId.get(c.poste_hors_client_id);
        const motif = motifParPoste.get(c.poste_hors_client_id);
        brutes.push({
          ...base,
          client: poste?.client ?? c.client_nom,
          site: poste?.site ?? c.site,
          nAffaire: "",
          pole: "",
          commune: "",
          communeConnue: true,
          source: motif ? "absence" : "poste",
          libelleSource: motif ? `Absence — ${motif.motif}` : "Hors client",
          heures: Number(c.heures_prevues),
          motifAbsence: motif?.motif ?? "",
          exclusPanier: motif ? motif.exclu_panier : true,
        });
        continue;
      }
      const s = c.site_id ? siteParId.get(c.site_id) : undefined;
      const cle = c.site_id ? cleIntervention(c) : "";
      const reel = cle ? reelParGroupe.get(cle) : undefined;
      let heures = Number(c.heures_prevues);
      let source: Brute["source"] = "planning";
      let libelleSource = "Planning";
      if (reel && (reel.techs.size === 0 || reel.techs.has(t.technicien_id))) {
        const prevu = prevuParGroupeTech.get(`${cle}|${t.technicien_id}`) ?? 0;
        heures = prevu > 0 ? (reel.parTech * Number(c.heures_prevues)) / prevu : reel.parTech;
        source = "bi";
        libelleSource = `Réel ${reel.bi.numero}`;
      }
      const d = c.devis_id ? devisParId.get(c.devis_id) : undefined;
      const commune = s?.commune?.trim() ?? "";
      brutes.push({
        ...base,
        client: s?.nom ?? c.client_nom,
        site: s?.site ?? c.site,
        nAffaire: d?.numero || s?.n_affaire || "",
        pole: d ? d.nature : Poles.entretienSousContrat,
        commune,
        communeConnue: Boolean(commune) && tarif.has(normaliserCle(commune)),
        source,
        libelleSource,
        heures: arrondi(heures),
        motifAbsence: "",
        exclusPanier: false,
      });
    }
  }
  for (const b of (bisDepannage ?? []) as { id: string; numero: string; site_id: string | null; client_nom: string; site: string; temps_passe: string; techniciens: string[]; date_intervention: string; date_debut: string }[]) {
    const date = isoDepuisFr(b.date_intervention || b.date_debut);
    const total = dureeEnHeures(b.temps_passe ?? "");
    if (!date || date < debut || date > finMois || total === null) continue;
    const parTech = total / Math.max(1, (b.techniciens ?? []).length);
    const s = b.site_id ? siteParId.get(b.site_id) : undefined;
    const commune = s?.commune?.trim() ?? "";
    for (const nom of b.techniciens ?? []) {
      const pid = profilParNom.get(nom.trim().toLowerCase());
      if (!pid) continue;
      brutes.push({
        cle: `bi-${b.id}-${pid}`,
        date,
        profileId: pid,
        salarie: salarieParProfil.get(pid) ?? nom,
        ordre: ordre++,
        lien: `/bi/${b.id}`,
        client: s?.nom ?? b.client_nom,
        site: s?.site ?? b.site,
        nAffaire: s?.n_affaire ?? "",
        pole: Poles.depannage,
        commune,
        communeConnue: Boolean(commune) && tarif.has(normaliserCle(commune)),
        source: "depannage",
        libelleSource: `Dépannage ${b.numero}`,
        heures: arrondi(parTech),
        motifAbsence: "",
        exclusPanier: false,
      });
    }
  }

  // ---- Véhicule personnel (décidé au cas par cas par le bureau)
  const { data: ajust } = await supabase.from("rh_pointage_ajustements").select("profile_id, date, vehicule_personnel").gte("date", debutMois).lte("date", finMois);
  const vehicule = new Set(((ajust ?? []) as { profile_id: string; date: string; vehicule_personnel: boolean }[]).filter((a) => a.vehicule_personnel).map((a) => `${a.profile_id}|${a.date}`));

  // ---- Ventilation (ordre chronologique par salarié)
  brutes.sort((a, b) => a.profileId.localeCompare(b.profileId) || a.date.localeCompare(b.date) || a.ordre - b.ordre);
  const hnSemaine = new Map<string, number>();
  const hsSemaine = new Map<string, number>();
  const travailJour = new Map<string, number>();
  const panierJour = new Set<string>();
  const maxHs25 = Math.max(0, parametres.plafond_hs25_hebdo - parametres.duree_legale_hebdo);
  const resultat: LignePointage[] = [];

  for (const b of brutes) {
    const semaine = numeroSemaineIso(b.date);
    const cleSem = `${b.profileId}|${lundiDeLaSemaine(b.date)}`;
    const cleJour = `${b.profileId}|${b.date}`;
    let hn = 0;
    let hs25 = 0;
    let hs50 = 0;
    let hs100 = 0;
    if (jourSemaineUTC(b.date) === 0 || joursFeries.includes(b.date)) {
      hs100 = b.heures;
    } else if (b.source === "absence") {
      hn = b.heures;
      hnSemaine.set(cleSem, (hnSemaine.get(cleSem) ?? 0) + hn);
    } else {
      const dispo = Math.max(0, parametres.duree_legale_hebdo - (hnSemaine.get(cleSem) ?? 0));
      hn = Math.min(b.heures, dispo);
      hnSemaine.set(cleSem, (hnSemaine.get(cleSem) ?? 0) + hn);
      const hs = b.heures - hn;
      if (hs > 0) {
        const dispo25 = Math.max(0, maxHs25 - (hsSemaine.get(cleSem) ?? 0));
        hs25 = Math.min(hs, dispo25);
        hs50 = hs - hs25;
        hsSemaine.set(cleSem, (hsSemaine.get(cleSem) ?? 0) + hs);
      }
    }
    let panierNb = 0;
    if (!b.exclusPanier) {
      const cumul = (travailJour.get(cleJour) ?? 0) + b.heures;
      travailJour.set(cleJour, cumul);
      if (cumul > parametres.panier_seuil_heures && !panierJour.has(cleJour)) {
        panierJour.add(cleJour);
        panierNb = 1;
      }
    }
    if (b.date < debutMois) continue;
    resultat.push({
      cle: b.cle,
      date: b.date,
      mois: m,
      semaine,
      profileId: b.profileId,
      salarie: b.salarie,
      client: b.client,
      site: b.site,
      nAffaire: b.nAffaire,
      pole: b.pole,
      commune: b.commune,
      communeConnue: b.communeConnue,
      source: b.source,
      libelleSource: b.libelleSource,
      heures: b.heures,
      hn: arrondi(hn),
      hs25: arrondi(hs25),
      hs50: arrondi(hs50),
      hs100: arrondi(hs100),
      panierNb,
      panierMontant: panierNb ? parametres.panier_montant : 0,
      trajet: 0,
      transport: 0,
      vehiculePerso: vehicule.has(cleJour),
      motifAbsence: b.motifAbsence,
      lien: b.lien,
    });
  }

  // ---- Trajet et transport : un par jour, la commune la plus chère.
  const parJour = new Map<string, LignePointage[]>();
  for (const l of resultat) parJour.set(`${l.profileId}|${l.date}`, [...(parJour.get(`${l.profileId}|${l.date}`) ?? []), l]);
  for (const lignes of parJour.values()) {
    let meilleure: LignePointage | null = null;
    let montant = 0;
    for (const l of lignes) {
      const t = l.commune ? tarif.get(normaliserCle(l.commune)) : undefined;
      if (t && Number(t.prime_trajet) > montant) {
        montant = Number(t.prime_trajet);
        meilleure = l;
      }
    }
    if (meilleure) {
      const t = tarif.get(normaliserCle(meilleure.commune))!;
      meilleure.trajet = Number(t.prime_trajet);
      if (meilleure.vehiculePerso) meilleure.transport = Number(t.prime_transport);
    }
  }

  resultat.sort((a, b) => a.salarie.localeCompare(b.salarie, "fr") || a.date.localeCompare(b.date));

  // ---- Contrôles
  const techniciens = ((profils ?? []) as { id: string; name: string; role: string }[])
    .filter((p) => p.role === "technicien" || p.role === "en_attente")
    .map((p) => ({ id: p.id, name: p.name, salarie: salarieParProfil.get(p.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const sitesUtilises = new Map<string, number>();
  const sitesSansCommune = new Map<string, { id: string; nom: string; site: string }>();
  for (const c of liste) {
    if (!c.site_id || c.date < debutMois) continue;
    const s = siteParId.get(c.site_id);
    if (!s) continue;
    const commune = s.commune?.trim() ?? "";
    if (!commune) sitesSansCommune.set(s.id, { id: s.id, nom: s.nom, site: s.site });
    else if (!tarif.has(normaliserCle(commune))) sitesUtilises.set(commune, (sitesUtilises.get(commune) ?? 0) + 1);
  }

  return {
    lignes: resultat,
    parametres,
    joursFeries,
    techniciens,
    sitesSansCommune: [...sitesSansCommune.values()],
    communesHorsBareme: [...sitesUtilises.entries()].map(([commune, nb]) => ({ commune, nb })),
  };
}

/// Journées incomplètes (heures saisies sous l'horaire attendu), du 1er du mois
/// jusqu'à hier, jours ouvrés et non fériés, pour chaque technicien.
export function journeesIncompletes(d: DonneesPointage, mois: string, aujourdhui: string) {
  const [an, m] = mois.split("-").map(Number);
  const fin = new Date(Date.UTC(an, m, 0)).toISOString().slice(0, 10);
  const limite = fin < aujourdhui ? fin : ajouterJours(aujourdhui, -1);
  const total = new Map<string, number>();
  for (const l of d.lignes) total.set(`${l.profileId}|${l.date}`, (total.get(`${l.profileId}|${l.date}`) ?? 0) + l.heures);
  const anomalies: { date: string; technicien: string; profileId: string; saisies: number; attendues: number }[] = [];
  for (let jour = `${mois}-01`; jour <= limite; jour = ajouterJours(jour, 1)) {
    const attendues = horaireAttendu(d.parametres, jour);
    if (!attendues || d.joursFeries.includes(jour)) continue;
    for (const t of d.techniciens) {
      const saisies = arrondi(total.get(`${t.id}|${jour}`) ?? 0);
      if (saisies < attendues - 0.01) anomalies.push({ date: jour, technicien: t.salarie ?? t.name, profileId: t.id, saisies, attendues });
    }
  }
  return anomalies;
}
