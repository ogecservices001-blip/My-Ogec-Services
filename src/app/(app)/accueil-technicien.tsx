import Link from "next/link";
import { CalendarDays, ClipboardCheck, ClipboardList, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";
import { chargerMesCreneaux } from "./planning/actions";
import { CreneauCarte } from "./planning/creneau-carte";
import { BoutonBi, type EtatIntervention } from "./planning/mon-planning/ma-semaine";
import { biDesInterventions, cleIntervention, creneauxDesInterventions, periodeIntervention } from "@/lib/planning/intervention";
import { chargerEtatsValidation } from "@/lib/planning/validation";
import { formaterJourCourt, formaterJourLong } from "@/lib/planning/dates";
import { labelPole } from "@/lib/bi/constants";
import { ActiverNotifications } from "@/components/notifications/activer-notifications";

/// Date du jour à La Réunion (le serveur tourne en UTC : avant 4 h du matin,
/// il serait encore la veille).
function aujourdhuiReunion(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date());
}

const TITRE = "mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500";

/// Accueil du technicien : ce qu'il a à faire, sans devoir penser à ouvrir
/// « Mon planning ».
export async function AccueilTechnicien({ profile, prenom }: { profile: Profile; prenom: string }) {
  const jour = aujourdhuiReunion();
  const supabase = await createClient();

  const [creneaux, { data: demandes }, { data: brouillons }] = await Promise.all([
    chargerMesCreneaux(jour, jour),
    supabase
      .from("demandes_depannage")
      .select("id, numero, client_nom, client_site, equipement_nom, message, date_intervention_prevue, bon_intervention_id")
      .eq("intervenant_id", profile.id)
      .eq("statut", "nouvelle"),
    supabase
      .from("bons_intervention")
      .select("id, numero, pole, client_nom, site, equipement_nom, depannage_id, updated_at")
      .eq("statut", "brouillon")
      .eq("created_by", profile.name)
      .order("updated_at", { ascending: false }),
  ]);

  const idsBi = [...new Set((demandes ?? []).map((d) => d.bon_intervention_id).filter((x): x is string => Boolean(x)))];
  const { data: biLies } = idsBi.length
    ? await supabase.from("bons_intervention").select("id, statut").in("id", idsBi)
    : { data: [] as { id: string; statut: string }[] };
  const biTransmis = new Set((biLies ?? []).filter((b) => b.statut !== "brouillon").map((b) => b.id));
  const brouillonParDepannage = new Map(
    (brouillons ?? []).filter((b) => b.depannage_id).map((b) => [b.depannage_id as string, b.id]),
  );

  const depannages = (demandes ?? [])
    .filter((d) => !(d.bon_intervention_id && biTransmis.has(d.bon_intervention_id)))
    .sort((a, b) => (a.date_intervention_prevue ?? "9999").localeCompare(b.date_intervention_prevue ?? "9999"));

  const avecSite = creneaux.filter((c) => c.site_id);
  const groupes = await creneauxDesInterventions(supabase, avecSite);
  const bis = await biDesInterventions(supabase, groupes);
  const etats: Record<string, EtatIntervention> = {};
  for (const c of avecSite) {
    const cle = cleIntervention(c);
    const periode = periodeIntervention(groupes, cle) ?? { debut: c.date, fin: c.date };
    etats[c.id] = { dernierJour: c.date === periode.fin, fin: periode.fin, bi: bis.get(cle) ?? null };
  }
  const validations = await chargerEtatsValidation(supabase, creneaux.map((c) => c.id));

  function quand(date: string | null): { texte: string; style: string } {
    if (!date) return { texte: "Sans date", style: "bg-slate-100 text-slate-600" };
    if (date < jour) return { texte: `En retard (${formaterJourCourt(date)})`, style: "bg-red-100 text-red-700" };
    if (date === jour) return { texte: "Aujourd'hui", style: "bg-red-600 text-white" };
    return { texte: `Prévu le ${formaterJourCourt(date)}`, style: "bg-blue-100 text-blue-700" };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{prenom ? `Bonjour ${prenom}` : "Bonjour"}</h1>
        <p className="text-sm font-semibold text-brand-green-dark">Aujourd&apos;hui : {formaterJourLong(jour)}</p>
      </div>

      <ActiverNotifications />

      <section>
        <p className={TITRE}>
          <Wrench className="h-4 w-4 text-red-600" /> Tes dépannages ({depannages.length})
        </p>
        {depannages.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Aucun dépannage pour toi.</p>
        ) : (
          <div className="space-y-2">
            {depannages.map((d) => {
              const q = quand(d.date_intervention_prevue);
              const brouillon = brouillonParDepannage.get(d.id);
              return (
                <div key={d.id} className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${q.style}`}>{q.texte}</span>
                    <span className="text-xs font-semibold text-slate-500">N°{d.numero}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {[d.client_nom, d.client_site].filter(Boolean).join(" — ")}
                  </p>
                  {d.equipement_nom && <p className="text-xs text-slate-600">{d.equipement_nom}</p>}
                  {d.message && <p className="mt-1 line-clamp-3 text-sm text-slate-700">{d.message}</p>}
                  <Link
                    href={brouillon ? `/bi/nouveau?brouillonId=${brouillon}` : `/bi/nouveau?depannageId=${d.id}`}
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-sm ${
                      brouillon ? "bg-amber-500 hover:bg-amber-600" : "bg-brand-green hover:bg-brand-green-dark"
                    }`}
                  >
                    <ClipboardCheck className="h-4 w-4" strokeWidth={2.25} />
                    {brouillon ? "Reprendre le BI" : "Faire le BI"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <p className={TITRE}>
          <CalendarDays className="h-4 w-4 text-brand-green" /> Tes créneaux du jour ({creneaux.length})
        </p>
        {creneaux.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Aucun créneau aujourd&apos;hui.</p>
        ) : (
          <div className="space-y-3">
            {creneaux.map((c) => (
              <div key={c.id} className="space-y-1.5">
                <CreneauCarte creneau={{ ...c, validation: validations.get(c.id) ?? null }} />
                {c.site_id && <BoutonBi creneau={c} etat={etats[c.id]} />}
              </div>
            ))}
          </div>
        )}
        <Link
          href="/planning/mon-planning"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green-dark hover:underline"
        >
          Voir toute ma semaine
        </Link>
      </section>

      <section>
        <p className={TITRE}>
          <ClipboardList className="h-4 w-4 text-amber-600" /> Tes BI en brouillon ({brouillons?.length ?? 0})
        </p>
        {!brouillons?.length ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">Aucun BI en cours.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {brouillons.map((b, i) => (
              <Link
                key={b.id}
                href={`/bi/nouveau?brouillonId=${b.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-amber-50 ${i > 0 ? "border-t border-slate-100" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {[b.client_nom, b.site].filter(Boolean).join(" — ") || "Sans client"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[labelPole(b.pole), b.equipement_nom].filter(Boolean).join(" · ")} — modifié le{" "}
                    {new Date(b.updated_at).toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" })}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">Reprendre</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
