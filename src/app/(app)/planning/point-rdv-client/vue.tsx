"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, ChevronDown, History } from "lucide-react";
import { ChoixClientSite } from "@/components/choix-client-site";
import { accepterDateClient, relancerMaintenant, replanifierDemande, type ConflitDate } from "../validation-actions";
import { DemandeValidation } from "../demande-validation";
import { libelleDatesProposees, libelleJours, type DateProposee, type JourDemande } from "@/lib/planning/periode";
import { lundiDeLaSemaine } from "@/lib/planning/dates";
import { LIBELLE_EVENEMENT, MAILS_CLIENT, type EntreeHistorique } from "@/lib/planning/validation-historique";

export type EtatRdv = "a_traiter" | "a_reproposer" | "attente" | "valide" | "remplacee";
type Onglet = EtatRdv | "toutes" | "archives";

export type DemandeRdv = {
  id: string;
  siteId: string;
  etat: EtatRdv;
  archivee: boolean;
  bi: { id: string; numero: string } | null;
  datePasseeSansBi: boolean;
  client_nom: string;
  site: string;
  objet: string;
  jours: JourDemande[];
  proposees: DateProposee[];
  commentaire: string;
  destinataire: string;
  envoyeLe: string;
  expiree: boolean;
  historique: EntreeHistorique[];
  prochaine: { libelle: string; date: string } | null;
  sansReponse: boolean;
  premierCreneauId: string;
};

const ONGLETS: { valeur: Onglet; libelle: string; pastille: string }[] = [
  { valeur: "a_traiter", libelle: "À traiter", pastille: "bg-purple-600" },
  { valeur: "a_reproposer", libelle: "À re-proposer", pastille: "bg-red-600" },
  { valeur: "attente", libelle: "En attente", pastille: "bg-orange-500" },
  { valeur: "valide", libelle: "Validés", pastille: "bg-green-600" },
  { valeur: "toutes", libelle: "Toutes", pastille: "bg-slate-500" },
  { valeur: "archives", libelle: "Archives", pastille: "bg-slate-400" },
];

const STYLE_ETAT: Record<EtatRdv, string> = {
  a_traiter: "bg-purple-100 text-purple-700",
  a_reproposer: "bg-red-100 text-red-700",
  attente: "bg-orange-100 text-orange-700",
  valide: "bg-green-100 text-green-700",
  remplacee: "bg-slate-100 text-slate-500",
};
const LIBELLE_ETAT: Record<EtatRdv, string> = {
  a_traiter: "Autre date proposée",
  a_reproposer: "Date modifiée — à re-proposer",
  attente: "Attente validation client",
  valide: "Validé client",
  remplacee: "Remplacée par une demande plus récente",
};

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Reunion" });
const jourFr = (d: string) => libelleJours([{ date: d, heure: null }])[0];

export function PointRdvVue({ demandes }: { demandes: DemandeRdv[] }) {
  const [onglet, setOnglet] = useState<Onglet>(() =>
    demandes.some((d) => d.etat === "a_traiter") ? "a_traiter" : demandes.some((d) => d.etat === "a_reproposer") ? "a_reproposer" : "attente",
  );
  const [client, setClient] = useState("");
  const [siteId, setSiteId] = useState("");
  const sites = useMemo(() => {
    const m = new Map<string, { id: string; nom: string; site: string }>();
    for (const d of demandes) if (d.siteId && !m.has(d.siteId)) m.set(d.siteId, { id: d.siteId, nom: d.client_nom, site: d.site });
    return [...m.values()];
  }, [demandes]);
  const duPerimetre = useMemo(
    () => demandes.filter((d) => (siteId ? d.siteId === siteId : client ? d.client_nom === client : true)),
    [demandes, client, siteId],
  );
  const dansOnglet = (d: DemandeRdv, o: Onglet) => (o === "archives" ? d.archivee : !d.archivee && (o === "toutes" || d.etat === o));
  const compte = (o: Onglet) => duPerimetre.filter((d) => dansOnglet(d, o)).length;
  const visibles = duPerimetre.filter((d) => dansOnglet(d, onglet));

  return (
    <div>
      <Link
        href="/planning"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Planification
      </Link>
      <div className="mb-3">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Point RDV Client</h1>
        <p className="text-sm text-slate-500">Validation des dates d&apos;intervention par les clients, relances et historique des échanges</p>
      </div>
      <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm">
        <ChoixClientSite
          sites={sites}
          clientNom={client}
          siteId={siteId}
          idClient="rdv-client"
          idSite="rdv-site"
          obligatoire={false}
          onChange={(choix) => {
            setClient(choix.clientNom);
            setSiteId(choix.siteId);
          }}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-3 lg:grid-cols-6">
        {ONGLETS.map((o) => (
          <button
            key={o.valeur}
            type="button"
            onClick={() => setOnglet(o.valeur)}
            className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold sm:text-sm ${
              onglet === o.valeur ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {o.libelle}
            <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-[11px] font-bold text-white ${compte(o.valeur) ? o.pastille : "bg-slate-300"}`}>
              {compte(o.valeur)}
            </span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">Rien dans cette rubrique.</p>
      ) : (
        <div className="space-y-2">
          {visibles.map((d) => (
            <CarteDemande key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function CarteDemande({ d }: { d: DemandeRdv }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [conflits, setConflits] = useState<ConflitDate[]>([]);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [confirmerRelance, setConfirmerRelance] = useState(false);
  const [envoiOuvert, setEnvoiOuvert] = useState(false);
  const dernierMail = [...d.historique].reverse().find((h) => MAILS_CLIENT.includes(h.evenement));
  const lienPlanning = `/planning?semaine=${lundiDeLaSemaine(d.jours[0]?.date)}&creneau=${d.premierCreneauId}`;

  function agir(action: () => Promise<{ ok: boolean; erreur?: string; conflits?: ConflitDate[] }>, apres?: () => void) {
    setErreur(null);
    setConflits([]);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setErreur(res.erreur ?? "Action impossible.");
        setConflits(res.conflits ?? []);
        return;
      }
      setConfirmerRelance(false);
      apres?.();
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl bg-white px-4 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-bold text-slate-900">
          {d.client_nom} — {d.site}
        </span>
        <span className="text-slate-500">{d.objet.replace(/ de votre contrat de maintenance$/, "")}</span>
        <span className="text-slate-700">
          <span className="text-slate-400">Proposé : </span>
          {libelleJours(d.jours).join(", ")}
        </span>
        {d.etat === "a_traiter" && (
          <span className="font-semibold text-purple-800">
            → le client demande : {libelleDatesProposees(d.proposees).join(", ")}
            {d.commentaire && <span className="font-normal italic text-slate-500"> « {d.commentaire} »</span>}
          </span>
        )}
        <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STYLE_ETAT[d.etat]}`}>
          {LIBELLE_ETAT[d.etat]}
          {d.sansReponse && d.etat === "attente" ? " — sans réponse" : ""}
          {d.archivee ? " · archivée" : ""}
        </span>
        {d.bi && (
          <Link href={`/bi/${d.bi.id}`} className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
            BI fait — {d.bi.numero}
          </Link>
        )}
        {d.datePasseeSansBi && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">Date passée, pas de BI</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>
          <span className="text-slate-400">Interlocuteur : </span>
          {d.destinataire}
        </span>
        {dernierMail && (
          <span>
            <span className="text-slate-400">Dernier mail : </span>
            {LIBELLE_EVENEMENT[dernierMail.evenement].toLowerCase()} le {quand(dernierMail.le)}
          </span>
        )}
        {d.etat === "attente" && (
          <span className={d.prochaine && !d.expiree ? "" : "font-semibold text-amber-700"}>
            <span className="font-normal text-slate-400">Prochaine relance : </span>
            {d.expiree
              ? "aucune (date passée)"
              : d.prochaine
                ? `${d.prochaine.libelle}, ${jourFr(d.prochaine.date)} vers 8 h`
                : "plus de relance automatique"}
          </span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {d.etat === "a_traiter" && !d.archivee && (
            <>
              <button
                onClick={() => agir(() => accepterDateClient(d.id))}
                disabled={pending}
                className="rounded-md bg-brand-green px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
              >
                {pending ? "..." : d.proposees.length > 1 ? "Accepter ces dates" : "Accepter cette date"}
              </button>
              <button
                onClick={() => agir(() => replanifierDemande(d.id), () => router.push(lienPlanning))}
                disabled={pending}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Replanifier moi-même
              </button>
            </>
          )}
          {d.etat === "a_reproposer" && !d.archivee && !envoiOuvert && (
            <button onClick={() => setEnvoiOuvert(true)} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700">
              Envoyer la nouvelle date
            </button>
          )}
          {d.etat === "attente" && !d.archivee && !d.expiree && !confirmerRelance && (
            <button
              onClick={() => setConfirmerRelance(true)}
              className="rounded-md border border-orange-300 px-2.5 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
            >
              Relancer maintenant
            </button>
          )}
          <Link href={lienPlanning} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-green-dark hover:bg-brand-green/5">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2.25} />
            Voir au planning
          </Link>
          <button
            onClick={() => setHistoriqueOuvert((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            <History className="h-3.5 w-3.5" strokeWidth={2.25} />
            Historique échange client ({d.historique.length})
            <ChevronDown className={`h-3.5 w-3.5 transition ${historiqueOuvert ? "rotate-180" : ""}`} />
          </button>
        </span>
      </div>

      {erreur && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-semibold">{erreur}</p>
          {conflits.map((c) => (
            <p key={`${c.date}-${c.technicien}`}>
              {jourFr(c.date)} : {c.technicien} {c.motif}
            </p>
          ))}
        </div>
      )}

      {confirmerRelance && (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          <p className="font-semibold">Relancer {d.destinataire} maintenant ?</p>
          {dernierMail && (
            <p>
              Dernier mail reçu par le client : {LIBELLE_EVENEMENT[dernierMail.evenement].toLowerCase()} le {quand(dernierMail.le)}.
            </p>
          )}
          {d.prochaine && <p>Sans action de ta part : {d.prochaine.libelle.toLowerCase()} le {jourFr(d.prochaine.date)}.</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => agir(() => relancerMaintenant(d.id))}
              disabled={pending}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {pending ? "Envoi..." : "Oui, relancer"}
            </button>
            <button onClick={() => setConfirmerRelance(false)} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
              Annuler
            </button>
          </div>
        </div>
      )}

      {envoiOuvert && (
        <div className="mt-3 rounded-xl border border-slate-200 p-4">
          <DemandeValidation creneauId={d.premierCreneauId} />
        </div>
      )}

      {historiqueOuvert && (
        <ol className="mt-2 space-y-1 border-l-2 border-slate-200 pl-4">
          {d.historique.map((h, i) => (
            <li key={i} className="text-sm">
              <span className="font-semibold text-slate-800">{quand(h.le)}</span>
              <span className="text-slate-600"> — {LIBELLE_EVENEMENT[h.evenement]}</span>
              {h.detail && <span className="text-slate-500"> ({h.detail})</span>}
              {h.par && <span className="text-xs text-slate-400"> · {h.par}</span>}
            </li>
          ))}
          {d.prochaine && !d.expiree && (
            <li className="text-sm italic text-slate-400">
              Prévu : {d.prochaine.libelle.toLowerCase()} le {jourFr(d.prochaine.date)} vers 8 h
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
