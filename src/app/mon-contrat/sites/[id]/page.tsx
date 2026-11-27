import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck, CalendarClock, ClipboardCheck, FileText, MapPin } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte, siteDuClient, sitesAutorises } from "@/lib/espace-client/acces";
import { aujourdhuiReunion, avancementAnnee, prochainsPassages, visitesRealisees } from "@/lib/espace-client/donnees";
import { BoutonDeconnexion } from "../bouton-deconnexion";

export const dynamic = "force-dynamic";

const jourLong = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const jourCourt = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

function Carte({ titre, icone: Icone, children }: { titre: string; icone: typeof CalendarClock; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        <Icone className="h-4 w-4 text-[#4f9a41]" />
        {titre}
      </h2>
      {children}
    </section>
  );
}

export default async function SiteClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) redirect("/mon-contrat");
  const site = await siteDuClient(admin, email, id);
  if (!site) notFound();
  const plusieursSites = (await sitesAutorises(admin, email)).length > 1;

  const [passages, visites] = await Promise.all([prochainsPassages(admin, site.id), visitesRealisees(admin, site.id)]);
  const annee = Number(aujourdhuiReunion().slice(0, 4));
  const avancement = avancementAnnee(visites, annee);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {plusieursSites && (
            <Link href="/mon-contrat/sites" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" /> Vos sites
            </Link>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{site.site || site.nom}</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {[site.nom, site.adresse, [site.code_postal, site.commune].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <BoutonDeconnexion />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Carte titre="Prochain passage" icone={CalendarClock}>
          {passages.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun passage planifié pour le moment.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {passages.map((p, i) => (
                <li key={p.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${i === 0 ? "pt-0" : ""}`}>
                  <div>
                    <p className={`font-semibold ${i === 0 ? "text-lg text-slate-900" : "text-slate-800"}`}>
                      {jourLong(p.date)}
                      {p.heure ? ` · ${p.heure}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">{p.objet}</p>
                  </div>
                  {p.validation?.statut === "attente" && p.validation.lien ? (
                    <a href={p.validation.lien} className="rounded-xl bg-[#4f9a41] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3d7a32]">
                      Confirmer ce rendez-vous
                    </a>
                  ) : p.validation?.statut === "valide" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef6ec] px-2.5 py-1 text-xs font-bold text-[#3d7a32]">
                      <CalendarCheck className="h-3.5 w-3.5" /> Confirmé
                    </span>
                  ) : p.validation?.statut === "autre_date" ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      Autre date proposée : nous revenons vers vous
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre={`Visites d'entretien ${annee}`} icone={ClipboardCheck}>
          {avancement.total ? (
            <>
              <p className="text-3xl font-bold text-slate-900">
                {avancement.faites} <span className="text-lg font-semibold text-slate-400">sur {avancement.total}</span>
              </p>
              <p className="text-sm text-slate-500">visites réalisées cette année</p>
              <div className="mt-3 flex gap-1.5">
                {Array.from({ length: avancement.total }, (_, n) => (
                  <span key={n} className={`h-2.5 flex-1 rounded-full ${n < avancement.faites ? "bg-[#4f9a41]" : "bg-slate-200"}`} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Aucune visite d&apos;entretien réalisée cette année pour le moment.</p>
          )}
        </Carte>
      </div>

      <Carte titre="Visites réalisées" icone={FileText}>
        {visites.length === 0 ? (
          <p className="text-sm text-slate-500">Les rapports de vos visites d&apos;entretien apparaîtront ici.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visites.map((v) => (
              <li key={v.biId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold text-slate-800">{jourCourt(v.date)}</p>
                  <p className="text-sm text-slate-500">
                    {v.visite}
                    {v.annee ? ` — ${v.annee}` : ""} · {v.numero}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/mon-contrat/pdf/rapport/${v.biId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-[#4f9a41] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3d7a32]"
                  >
                    Rapport de visite
                  </a>
                  <a
                    href={`/mon-contrat/pdf/bi/${v.biId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Bon d&apos;intervention
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
