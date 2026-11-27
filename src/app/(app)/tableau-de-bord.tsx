import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Cog,
  FileClock,
  Percent,
  Receipt,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Statuts, labelPole } from "@/lib/bi/constants";
import { formaterJourCourt } from "@/lib/planning/dates";
import { STATUTS_BI_REALISE } from "./devis/statut";
import { motifPrincipal, transformation } from "@/lib/devis/suivi-commercial";
import { LIBELLE_SOURCE_INCIDENT, type SourceIncident } from "@/lib/incidents";

const JOURS_BROUILLON_OUBLIE = 3;
const MAX_LIGNES = 5;

type Ligne = { id: string; href: string; titre: string; detail: string; alerte?: boolean };

/// Date du jour à La Réunion (le serveur tourne en UTC).
function aujourdhuiReunion(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date());
}

/// « 26/11/2026 » → « 2026-11-26 » ; vide si illisible.
function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function joursDepuis(iso: string, jour: string): number {
  return Math.floor((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const clientSite = (client: string, site: string) => [client, site].filter(Boolean).join(" — ");

/// Accueil des administrateurs : ce qui attend une action du bureau.
export async function TableauDeBord({ prenom }: { prenom: string }) {
  const jour = aujourdhuiReunion();
  const supabase = await createClient();

  const [
    { data: biAVerifier },
    { data: depannages },
    { data: devis },
    { data: bonsDevis },
    { data: equipements },
    { data: demandesRdv },
    { data: brouillons },
  ] = await Promise.all([
    supabase
      .from("bons_intervention")
      .select("id, numero, pole, client_nom, site, created_by, date_signature, updated_at")
      .in("statut", [Statuts.aVerifier, Statuts.erreurSync])
      .order("updated_at", { ascending: true }),
    supabase
      .from("demandes_depannage")
      .select("id, numero, client_nom, client_site, equipement_nom, date_creation, date_intervention_prevue, intervenant_id, bon_intervention_id")
      .eq("statut", "nouvelle")
      .order("date_creation", { ascending: true }),
    supabase
      .from("devis")
      .select("id, numero, site_id, libelle, montant, date_devis, created_at, date_commande_client, mois_facturation, annule, bi_reference_historique, rappel_relance, prochaine_relance, perdu_le, motif_perte"),
    supabase.from("bons_intervention").select("devis_id, statut").not("devis_id", "is", null),
    supabase
      .from("equipements")
      .select("id, nom, site_id, created_at")
      .eq("a_valider", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("demandes_validation_client")
      .select("id, client_nom, site, statut, traite_le, jours, envoye_le")
      .in("statut", ["attente", "autre_date"]),
    supabase
      .from("bons_intervention")
      .select("id, pole, client_nom, site, created_by, updated_at")
      .eq("statut", Statuts.brouillon)
      .order("updated_at", { ascending: true }),
  ]);

  const [{ data: profils }, { data: sites }, { data: incidents }] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    supabase.from("sites").select("id, nom, site"),
    supabase.from("incidents").select("id, titre, source, created_at").is("resolu_le", null).order("created_at", { ascending: false }),
  ]);
  const nomProfil = new Map((profils ?? []).map((p) => [p.id, p.name]));
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));

  // ---------- BI à vérifier ----------
  const lignesBi: Ligne[] = (biAVerifier ?? []).map((b) => ({
    id: b.id,
    href: `/bi/${b.id}`,
    titre: `${b.numero || "BI"} — ${clientSite(b.client_nom, b.site)}`,
    detail: [labelPole(b.pole), b.created_by].filter(Boolean).join(" · "),
  }));

  // ---------- Dépannages ----------
  const idsBi = [...new Set((depannages ?? []).map((d) => d.bon_intervention_id).filter((x): x is string => Boolean(x)))];
  const { data: biDepannages } = idsBi.length
    ? await supabase.from("bons_intervention").select("id, statut").in("id", idsBi)
    : { data: [] as { id: string; statut: string }[] };
  const biTransmis = new Set((biDepannages ?? []).filter((b) => b.statut !== Statuts.brouillon).map((b) => b.id));
  const ouverts = (depannages ?? []).filter((d) => !(d.bon_intervention_id && biTransmis.has(d.bon_intervention_id)));
  const nonAffectes: Ligne[] = ouverts
    .filter((d) => !d.intervenant_id)
    .map((d) => ({
      id: d.id,
      href: `/depannages/${d.id}`,
      titre: `N°${d.numero} — ${clientSite(d.client_nom, d.client_site)}`,
      detail: `Non affecté · demandé le ${new Date(d.date_creation).toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" })}`,
      alerte: true,
    }));
  const nonFaits: Ligne[] = ouverts
    .filter((d) => d.intervenant_id && d.date_intervention_prevue && d.date_intervention_prevue < jour)
    .map((d) => ({
      id: d.id,
      href: `/depannages/${d.id}`,
      titre: `N°${d.numero} — ${clientSite(d.client_nom, d.client_site)}`,
      detail: `Prévu le ${formaterJourCourt(d.date_intervention_prevue as string)} · ${nomProfil.get(d.intervenant_id as string) ?? "?"} · pas de BI`,
      alerte: true,
    }));

  // ---------- Devis ----------
  const devisRealises = new Set(
    (bonsDevis ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );
  const devisValides = (devis ?? []).filter((d) => d.numero && !d.annule);
  const libelleDevis = (d: (typeof devisValides)[number]) => {
    const s = siteParId.get(d.site_id);
    return `${d.numero} — ${clientSite(s?.nom ?? "", s?.site ?? "")}`;
  };
  const montant = (m: number | null) =>
    m === null ? "" : `${m.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;

  // Seuls les devis dont le bureau a demandé un rappel, une fois la date
  // arrivée.
  const aRelancer: Ligne[] = devisValides
    .filter(
      (d) =>
        d.rappel_relance &&
        d.prochaine_relance &&
        d.prochaine_relance <= jour &&
        !d.perdu_le &&
        !d.date_commande_client &&
        !d.mois_facturation &&
        !devisRealises.has(d.id) &&
        !d.bi_reference_historique,
    )
    .sort((a, b) => (a.prochaine_relance ?? "").localeCompare(b.prochaine_relance ?? ""))
    .map((d) => ({
      id: d.id,
      href: `/devis/${d.id}/statut`,
      titre: libelleDevis(d),
      detail: [`Relance prévue le ${formaterJourCourt(d.prochaine_relance as string)}`, montant(d.montant), d.libelle]
        .filter(Boolean)
        .join(" · "),
      alerte: joursDepuis(d.prochaine_relance as string, jour) > 7,
    }));

  const anneeEnCours = jour.slice(0, 4);
  const taux = transformation(
    devisValides.map((d) => ({
      annee: (isoDepuisFr(d.date_devis) || d.created_at).slice(0, 4),
      montant: d.montant,
      gagne: Boolean(d.date_commande_client || d.mois_facturation || devisRealises.has(d.id) || d.bi_reference_historique),
      perdu: Boolean(d.perdu_le),
      motifPerte: motifPrincipal(d.motif_perte),
    })),
    anneeEnCours,
  );

  const aFacturer: Ligne[] = devisValides
    .filter((d) => !d.mois_facturation && (devisRealises.has(d.id) || Boolean(d.bi_reference_historique)))
    .map((d) => ({
      id: d.id,
      href: `/devis/${d.id}/statut`,
      titre: libelleDevis(d),
      detail: [montant(d.montant), d.libelle].filter(Boolean).join(" · "),
    }));
  const totalAFacturer = devisValides
    .filter((d) => !d.mois_facturation && (devisRealises.has(d.id) || Boolean(d.bi_reference_historique)))
    .reduce((t, d) => t + (d.montant ?? 0), 0);

  // ---------- Équipements à valider ----------
  const lignesEquipements: Ligne[] = (equipements ?? []).map((e) => {
    const s = siteParId.get(e.site_id);
    return {
      id: e.id,
      href: `/gmao/clients/${e.site_id}/equipements/${e.id}`,
      titre: e.nom,
      detail: clientSite(s?.nom ?? "", s?.site ?? ""),
    };
  });

  // ---------- Créneaux non validés par le client ----------
  const lignesRdv: Ligne[] = (demandesRdv ?? [])
    .map((d) => {
      const jours = (d.jours as { date: string }[] | null) ?? [];
      const premier = jours[0]?.date ?? "";
      return { d, premier };
    })
    .filter(({ d, premier }) => (d.statut === "autre_date" ? !d.traite_le : !premier || premier >= jour))
    .sort((a, b) => (a.d.statut === b.d.statut ? a.premier.localeCompare(b.premier) : a.d.statut === "autre_date" ? -1 : 1))
    .map(({ d, premier }) => ({
      id: d.id,
      href: "/planning/point-rdv-client",
      titre: clientSite(d.client_nom, d.site),
      detail:
        d.statut === "autre_date"
          ? "Le client propose une autre date : à traiter"
          : `Sans réponse du client${premier ? ` · intervention le ${formaterJourCourt(premier)}` : ""}`,
      alerte: d.statut === "autre_date",
    }));

  // ---------- BI oubliés en brouillon ----------
  const lignesBrouillons: Ligne[] = (brouillons ?? [])
    .map((b) => ({ b, age: joursDepuis(b.updated_at, jour) }))
    .filter(({ age }) => age > JOURS_BROUILLON_OUBLIE)
    .map(({ b, age }) => ({
      id: b.id,
      href: `/bi/${b.id}`,
      titre: clientSite(b.client_nom, b.site) || "Sans client",
      detail: [labelPole(b.pole), b.created_by, `dernière modification il y a ${age} jours`].filter(Boolean).join(" · "),
    }));

  const lignesIncidents: Ligne[] = (incidents ?? []).map((i) => ({
    id: i.id,
    href: "/erreurs",
    titre: i.titre,
    detail: `${LIBELLE_SOURCE_INCIDENT[i.source as SourceIncident] ?? i.source} · ${new Date(i.created_at).toLocaleString("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "short", timeStyle: "short" })}`,
    alerte: true,
  }));

  const rien =
    lignesIncidents.length +
    lignesBi.length + nonAffectes.length + nonFaits.length + aRelancer.length + aFacturer.length + lignesEquipements.length + lignesRdv.length + lignesBrouillons.length ===
    0;

  return (
    <div className="space-y-5 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{prenom ? `Bonjour ${prenom}` : "Bonjour"}</h1>
        <p className="text-sm font-semibold text-brand-green-dark">
          {rien ? "Rien en attente : tout est à jour." : "Ce qui attend le bureau"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lignesIncidents.length > 0 && (
          <Tuile icone={TriangleAlert} couleur="red" titre="Erreurs à traiter" lignes={lignesIncidents} lienTout="/erreurs" vide="" />
        )}
        <Tuile icone={ClipboardCheck} couleur="violet" titre="BI à vérifier" lignes={lignesBi} lienTout="/bi" vide="Aucun BI à vérifier." />
        <Tuile
          icone={Wrench}
          couleur="red"
          titre="Dépannages non affectés"
          lignes={nonAffectes}
          lienTout="/depannages"
          vide="Tous les dépannages ont un technicien."
        />
        <Tuile
          icone={Wrench}
          couleur="orange"
          titre="Dépannages non effectués"
          sousTitre="Date prévue passée, sans BI"
          lignes={nonFaits}
          lienTout="/depannages"
          vide="Aucun dépannage en retard."
        />
        <Tuile
          icone={CalendarClock}
          couleur="purple"
          titre="Créneaux non validés par le client"
          lignes={lignesRdv}
          lienTout="/planning/point-rdv-client"
          vide="Aucun créneau en attente du client."
        />
        <Tuile
          icone={FileClock}
          couleur="amber"
          titre="Devis à relancer"
          sousTitre="Rappels arrivés à échéance"
          lignes={aRelancer}
          lienTout="/devis"
          vide="Aucun devis à relancer."
        />
        <Tuile
          icone={Receipt}
          couleur="green"
          titre="Devis à facturer"
          sousTitre={
            totalAFacturer > 0
              ? `Réalisés, pas encore facturables · ${totalAFacturer.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € HT`
              : "Réalisés, pas encore facturables"
          }
          lignes={aFacturer}
          lienTout="/devis"
          vide="Aucun devis réalisé en attente de facturation."
        />
        <Tuile
          icone={Cog}
          couleur="teal"
          titre="Équipements à valider"
          lignes={lignesEquipements}
          lienTout="/gmao/clients"
          vide="Aucun équipement à valider."
        />
        <TuileTransformation taux={taux} />
        <Tuile
          icone={ClipboardList}
          couleur="slate"
          titre="BI oubliés en brouillon"
          sousTitre={`Pas touchés depuis plus de ${JOURS_BROUILLON_OUBLIE} jours`}
          lignes={lignesBrouillons}
          vide="Aucun BI oublié."
        />
      </div>
    </div>
  );
}

const COULEURS: Record<string, { pastille: string; icone: string }> = {
  violet: { pastille: "bg-violet-600", icone: "text-violet-600" },
  red: { pastille: "bg-red-600", icone: "text-red-600" },
  orange: { pastille: "bg-orange-500", icone: "text-orange-500" },
  purple: { pastille: "bg-purple-600", icone: "text-purple-600" },
  amber: { pastille: "bg-amber-500", icone: "text-amber-600" },
  green: { pastille: "bg-brand-green", icone: "text-brand-green" },
  teal: { pastille: "bg-teal-600", icone: "text-teal-600" },
  slate: { pastille: "bg-slate-500", icone: "text-slate-500" },
};

function Tuile({
  icone: Icone,
  couleur,
  titre,
  sousTitre,
  lignes,
  lienTout,
  vide,
}: {
  icone: LucideIcon;
  couleur: keyof typeof COULEURS;
  titre: string;
  sousTitre?: string;
  lignes: Ligne[];
  lienTout?: string;
  vide: string;
}) {
  const c = COULEURS[couleur];
  const n = lignes.length;
  return (
    <section className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${n ? "border-slate-200/80" : "border-slate-100 opacity-75"}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Icone className={`h-4 w-4 shrink-0 ${c.icone}`} strokeWidth={2.25} />
            {titre}
          </p>
          {sousTitre && <p className="mt-0.5 text-xs text-slate-500">{sousTitre}</p>}
        </div>
        <span
          className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-2 text-lg font-bold ${
            n ? `${c.pastille} text-white` : "bg-slate-100 text-slate-400"
          }`}
        >
          {n}
        </span>
      </div>

      {n === 0 ? (
        <p className="py-2 text-sm text-slate-400">{vide}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {lignes.slice(0, MAX_LIGNES).map((l) => (
            <Link key={l.id} href={l.href} className="block py-2 hover:bg-slate-50">
              <p className="truncate text-sm font-semibold text-slate-800">{l.titre}</p>
              <p className={`truncate text-xs ${l.alerte ? "text-red-600" : "text-slate-500"}`}>{l.detail}</p>
            </Link>
          ))}
        </div>
      )}

      {lienTout && n > 0 && (
        <Link href={lienTout} className="mt-auto pt-2 text-sm font-semibold text-brand-green-dark hover:underline">
          {n > MAX_LIGNES ? `Voir les ${n}` : "Ouvrir la liste"}
        </Link>
      )}
      {!lienTout && n > MAX_LIGNES && <p className="mt-auto pt-2 text-xs text-slate-500">… et {n - MAX_LIGNES} autres</p>}
    </section>
  );
}

function TuileTransformation({ taux }: { taux: ReturnType<typeof transformation> }) {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Percent className="h-4 w-4 text-brand-green" strokeWidth={2.25} />
            Taux de transformation {taux.annee}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Devis émis cette année et commandés</p>
        </div>
        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green px-2 text-lg font-bold text-white">
          {taux.tauxNombre === null ? "—" : `${taux.tauxNombre} %`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p className="text-slate-500">Émis : <span className="font-semibold text-slate-800">{taux.envoyes}</span></p>
        <p className="text-slate-500">Commandés : <span className="font-semibold text-brand-green-dark">{taux.gagnes}</span></p>
        <p className="text-slate-500">Perdus : <span className="font-semibold text-rose-600">{taux.perdus}</span></p>
        <p className="text-slate-500">En attente : <span className="font-semibold text-amber-600">{taux.enAttente}</span></p>
      </div>
      {taux.tauxMontant !== null && (
        <p className="mt-2 text-xs text-slate-500">
          En montant : {taux.tauxMontant} % ({taux.montantGagne.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € sur{" "}
          {taux.montantEnvoye.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € HT)
        </p>
      )}
      <Link href="/devis" className="mt-auto pt-2 text-sm font-semibold text-brand-green-dark hover:underline">
        Détail dans Suivi Devis
      </Link>
    </section>
  );
}
