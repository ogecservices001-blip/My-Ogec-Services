import Link from "next/link";
import { AlertTriangle, CalendarCheck, CalendarClock, ClipboardCheck, FileText } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { aujourdhuiReunion, avancementAnnee, prochainsPassages, visitesRealisees } from "@/lib/espace-client/donnees";
import { devisClient, equipementsClient } from "@/lib/espace-client/donnees-parc";
import { Carte, jourCourt, jourLong } from "./carte";

export const dynamic = "force-dynamic";

export default async function SiteClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, site } = await accesSite(id);

  const [passages, visites, equipements, devis] = await Promise.all([
    prochainsPassages(admin, site.id),
    visitesRealisees(admin, site.id),
    equipementsClient(admin, site.id),
    devisClient(admin, site.id),
  ]);
  const annee = Number(aujourdhuiReunion().slice(0, 4));
  const avancement = avancementAnnee(visites, annee);
  const horsFonction = equipements.filter((e) => e.etat && !e.etat.bon);
  const devisEnAttente = devis.filter((d) => d.attenteAccord);

  return (
    <div className="space-y-5">
      {(horsFonction.length > 0 || devisEnAttente.length > 0) && (
        <div className="space-y-2">
          {horsFonction.length > 0 && (
            <Link
              href={`/mon-contrat/sites/${site.id}/equipements`}
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                <strong>{horsFonction.length} équipement{horsFonction.length > 1 ? "s" : ""} hors fonctionnement</strong> :{" "}
                {horsFonction.map((e) => e.nom).join(", ")}
              </span>
            </Link>
          )}
          {devisEnAttente.length > 0 && (
            <Link
              href={`/mon-contrat/sites/${site.id}/devis`}
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span>
                <strong>{devisEnAttente.length} devis en attente de votre accord</strong>
              </span>
            </Link>
          )}
        </div>
      )}

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
