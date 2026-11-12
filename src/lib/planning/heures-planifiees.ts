import type { SupabaseClient } from "@supabase/supabase-js";
import { dureeEnHeures } from "@/lib/bi/format";
import { labelPole, Poles } from "@/lib/bi/constants";
import { cleIntervention, type CreneauIntervention } from "./intervention";

/// Heures Planifiées : pour un client ou un site et une année, une ligne par
/// intervention (visite d'entretien, travaux sur devis, dépannage, autre BI),
/// heures prévues au planning et heures réalisées (temps passé des BI).

export type TypeLigne = "entretien" | "devis" | "depannage" | "autre";

export type LigneHeuresPlanifiees = {
  cle: string;
  type: TypeLigne;
  libelleType: string;
  debut: string;
  fin: string;
  site: string;
  detail: string;
  techniciens: string[];
  heuresPrevues: number | null;
  heuresRealisees: number | null;
  etat: string;
  biId: string | null;
};

export type ResultatHeuresPlanifiees = {
  lignes: LigneHeuresPlanifiees[];
  totaux: Record<TypeLigne, { prevues: number; realisees: number; nombre: number }>;
  heuresContrat: number;
};

const LIBELLES: Record<TypeLigne, string> = {
  entretien: "Visite d'entretien",
  devis: "Travaux sur devis",
  depannage: "Dépannage",
  autre: "Autre BI",
};

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

const STATUTS_LIBELLES: Record<string, string> = { averif: "à vérifier", valide: "validé", pdf: "validé", prete: "validé", envoye: "envoyé" };

export async function calculerHeuresPlanifiees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  siteIds: string[],
  annee: number,
): Promise<ResultatHeuresPlanifiees> {
  const totaux: ResultatHeuresPlanifiees["totaux"] = {
    entretien: { prevues: 0, realisees: 0, nombre: 0 },
    devis: { prevues: 0, realisees: 0, nombre: 0 },
    depannage: { prevues: 0, realisees: 0, nombre: 0 },
    autre: { prevues: 0, realisees: 0, nombre: 0 },
  };
  if (siteIds.length === 0) return { lignes: [], totaux, heuresContrat: 0 };
  const debutAn = `${annee}-01-01`;
  const finAn = `${annee}-12-31`;

  const [{ data: creneaux }, { data: bons }, { data: tickets }, { data: sites }, { data: devis }] = await Promise.all([
    supabase
      .from("creneaux_planning")
      .select("id, site_id, devis_id, visite_numero, visite_total, visite_annee, date, heures_prevues, site, creneau_techniciens(profiles(name))")
      .in("site_id", siteIds)
      .eq("annule", false)
      .gte("date", debutAn)
      .lte("date", finAn),
    supabase
      .from("bons_intervention")
      .select("id, numero, statut, pole, devis_id, devis_numero, creneau_id, temps_passe, techniciens, date_intervention, date_debut, date_fin, site, equipement_nom, visite_numero, visite_total, visite_annee")
      .in("site_id", siteIds)
      .neq("statut", "brouillon"),
    supabase
      .from("demandes_depannage")
      .select("id, numero, client_site, equipement_nom, date_intervention_prevue, intervenant_id, profiles:intervenant_id(name)")
      .in("site_id", siteIds)
      .neq("statut", "traitee")
      .gte("date_intervention_prevue", debutAn)
      .lte("date_intervention_prevue", finAn),
    supabase.from("sites").select("id, nb_heures_vendues").in("id", siteIds),
    supabase.from("devis").select("id, numero, libelle").in("site_id", siteIds),
  ]);

  const devisParId = new Map((devis ?? []).map((d) => [d.id, d]));
  const lignes: LigneHeuresPlanifiees[] = [];
  const bisRattaches = new Set<string>();

  type Creneau = CreneauIntervention & {
    visite_total: number | null;
    heures_prevues: number;
    site: string;
    creneau_techniciens: { profiles: { name: string } | { name: string }[] | null }[] | null;
  };
  const groupes = new Map<string, Creneau[]>();
  for (const c of (creneaux ?? []) as Creneau[]) {
    const cle = cleIntervention(c);
    groupes.set(cle, [...(groupes.get(cle) ?? []), c]);
  }

  for (const [cle, liste] of groupes) {
    const premier = liste[0];
    const dates = liste.map((c) => c.date).sort();
    const ids = new Set(liste.map((c) => c.id));
    const bi = (bons ?? []).find((b) => b.creneau_id && ids.has(b.creneau_id));
    if (bi) bisRattaches.add(bi.id);
    const techniciens = [
      ...new Set(
        liste.flatMap((c) =>
          (c.creneau_techniciens ?? []).flatMap((ct) => (Array.isArray(ct.profiles) ? ct.profiles : ct.profiles ? [ct.profiles] : []).map((p) => p.name)),
        ),
      ),
    ];
    const prevues = liste.reduce((t, c) => t + Number(c.heures_prevues) * Math.max(1, (c.creneau_techniciens ?? []).length), 0);
    const type: TypeLigne = premier.devis_id ? "devis" : "entretien";
    const d = premier.devis_id ? devisParId.get(premier.devis_id) : undefined;
    const detail =
      type === "devis"
        ? [d?.numero || "Devis", d?.libelle].filter(Boolean).join(" — ")
        : premier.visite_numero
          ? `Visite ${premier.visite_numero}/${premier.visite_total ?? "?"} — ${premier.visite_annee ?? annee}`
          : "Entretien";
    lignes.push({
      cle,
      type,
      libelleType: LIBELLES[type],
      debut: dates[0],
      fin: dates[dates.length - 1],
      site: premier.site,
      detail,
      techniciens,
      heuresPrevues: prevues,
      heuresRealisees: bi ? dureeEnHeures(bi.temps_passe ?? "") : null,
      etat: bi ? `Fait — ${bi.numero} (${STATUTS_LIBELLES[bi.statut] ?? bi.statut})` : dates[dates.length - 1] < new Date().toISOString().slice(0, 10) ? "Prévu (date passée, pas de BI)" : "Prévu",
      biId: bi?.id ?? null,
    });
  }

  for (const b of bons ?? []) {
    if (bisRattaches.has(b.id)) continue;
    const date = isoDepuisFr(b.date_intervention || b.date_debut || "");
    if (!date || date < debutAn || date > finAn) continue;
    const fin = isoDepuisFr(b.date_fin || "") || date;
    const type: TypeLigne = b.pole === Poles.depannage ? "depannage" : b.devis_id ? "devis" : b.pole === Poles.entretienSousContrat ? "entretien" : "autre";
    const detail =
      type === "depannage"
        ? b.equipement_nom || "Dépannage"
        : type === "devis"
          ? b.devis_numero || "Devis"
          : type === "entretien"
            ? b.visite_numero
              ? `Visite ${b.visite_numero}/${b.visite_total ?? "?"} — ${b.visite_annee ?? annee} (hors planning)`
              : "Entretien (hors planning)"
            : labelPole(b.pole);
    lignes.push({
      cle: `bi-${b.id}`,
      type,
      libelleType: LIBELLES[type],
      debut: date,
      fin: fin >= date ? fin : date,
      site: b.site,
      detail,
      techniciens: (b.techniciens as string[] | null) ?? [],
      heuresPrevues: null,
      heuresRealisees: dureeEnHeures(b.temps_passe ?? ""),
      etat: `Fait — ${b.numero} (${STATUTS_LIBELLES[b.statut] ?? b.statut})`,
      biId: b.id,
    });
  }

  for (const t of tickets ?? []) {
    const p = t.profiles as { name: string } | { name: string }[] | null;
    const nom = Array.isArray(p) ? p[0]?.name : p?.name;
    lignes.push({
      cle: `dem-${t.id}`,
      type: "depannage",
      libelleType: LIBELLES.depannage,
      debut: t.date_intervention_prevue as string,
      fin: t.date_intervention_prevue as string,
      site: t.client_site,
      detail: [t.numero, t.equipement_nom].filter(Boolean).join(" — "),
      techniciens: nom ? [nom] : [],
      heuresPrevues: null,
      heuresRealisees: null,
      etat: "À faire",
      biId: null,
    });
  }

  lignes.sort((a, b) => a.debut.localeCompare(b.debut) || a.site.localeCompare(b.site, "fr"));
  for (const l of lignes) {
    totaux[l.type].nombre++;
    totaux[l.type].prevues += l.heuresPrevues ?? 0;
    totaux[l.type].realisees += l.heuresRealisees ?? 0;
  }
  const heuresContrat = (sites ?? []).reduce((t, s) => t + (parseFloat(String(s.nb_heures_vendues ?? "").replace(",", ".")) || 0), 0);
  return { lignes, totaux, heuresContrat };
}
