"use client";

import { dateFrVersIso, formaterDate } from "@/lib/format";

import { useChampManquant, type CibleChamp } from "@/components/champ-manquant";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, X, FileText, ExternalLink, Mail } from "lucide-react";
import type { Tables } from "@/lib/types";
import { StatutBadge } from "@/components/bi/statut-badge";
import { Poles, Statuts, avecPeriode, sansMontant, labelPole, PHOTO_TYPES, CHAMPS_MATERIEL_EXCLUS_BI, CLASSEMENT_LABELS, POLE_PLUSIEURS_TYPES } from "@/lib/bi/constants";
import {
  equipementLabel,
  eur,
  montantLigne,
  totalHT,
  interventionsDuBon,
  ETATS_EQUIPEMENT,
  montantMainDoeuvre,
  montantDeplacements,
  type InterventionEquipement,
  type Presta,
} from "@/lib/bi/format";
import { validerBI, urlPhotoSignee, urlArchiveSignee, envoyerBiParEmail, classerBI, type CorrectionInput, rattacherRelevesEnAttente, envoyerRapportParEmail } from "./actions";
import type { ChampEnTete, ChecklistItem } from "@/lib/gmao/types";
import { suggererNumeroEquipement } from "@/lib/gmao/numero-equipement";
import { libelleVisite, type VisiteSaisie } from "@/lib/gmao/visites";

/// BI Entretien sous contrat : proposition de n° de visite et équipements
/// entretenus, avec ou sans relevé technique (en attente avant validation,
/// rattaché à ce BI après).
export type InfosVisite = {
  proposition: VisiteSaisie;
  equipements: { nom: string; avecReleve: boolean }[];
  /// BI validé : relevés saisis depuis, pas encore rattachés.
  relevesEnAttente: number;
};

const STATUTS_AVEC_PDF = new Set<string>([Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye]);

type Bon = Tables<"bons_intervention">;
type TypeEquipementResume = { id: string; nom: string; champs_en_tete_supplementaires: unknown };
type ModeleResume = { champs: ChampEnTete[]; checklist: ChecklistItem[] } | null;
type TauxSiteComplet = {
  taux_horaire_regie: string;
  forfait_deplacement: string;
} | null;

export function BiDetail({
  bon,
  techniciensDisponibles,
  typesEquipement,
  modele,
  isAdmin,
  tauxSite,
  numeroAffaireSite,
  numerosEquipementSite,
  infosVisite,
}: {
  bon: Bon;
  infosVisite: InfosVisite | null;
  techniciensDisponibles: string[];
  typesEquipement: TypeEquipementResume[];
  modele: ModeleResume;
  isAdmin: boolean;
  tauxSite: TauxSiteComplet;
  numeroAffaireSite: string;
  numerosEquipementSite: string[];
}) {
  const router = useRouter();
  const enCorrection = isAdmin && bon.statut === Statuts.aVerifier;
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [modaleEmailOuverte, setModaleEmailOuverte] = useState(false);
  const [modaleRapportOuverte, setModaleRapportOuverte] = useState(false);

  useEffect(() => {
    if (bon.pdf_storage_path) urlArchiveSignee(bon.pdf_storage_path).then(setArchiveUrl);
  }, [bon.pdf_storage_path]);

  return (
    <div>
      <Link
        href={isAdmin ? "/bi" : "/"}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-slate-900">{bon.numero || "BI (brouillon)"}</p>
        <StatutBadge statut={bon.statut} />
      </div>

      {STATUTS_AVEC_PDF.has(bon.statut) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <a
            href={`/bi/${bon.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            Voir PDF
          </a>
          {archiveUrl && (
            <a
              href={archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
              Ouvrir l&apos;archive
            </a>
          )}
          {isAdmin && bon.email && (
            <button
              onClick={() => setModaleEmailOuverte(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
              Envoyer au client
            </button>
          )}
        </div>
      )}

      {enCorrection ? (
        <div className="space-y-4">
          <BlocClient bon={bon} />
          <VueCorrection
            bon={bon}
            techniciensDisponibles={techniciensDisponibles}
            tauxSite={tauxSite}
            numeroAffaireSite={numeroAffaireSite}
            numerosEquipementSite={numerosEquipementSite}
            infosVisite={infosVisite}
            onValide={() => router.refresh()}
          />
          <BlocHistorique bon={bon} />
        </div>
      ) : (
        <div className="space-y-4">
          <BlocClient bon={bon} />
          <VueLectureSeule bon={bon} typesEquipement={typesEquipement} modele={modele} />
          {bon.visite_numero !== null && infosVisite && (
            <Section titre={`Visite d'entretien — ${libelleVisite({ numero: bon.visite_numero, total: bon.visite_total, annee: bon.visite_annee })}`}>
              <RelevesDeLaVisite equipements={infosVisite.equipements} rattaches />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`/bi/${bon.id}/rapport`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                >
                  <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                  Rapport technique (PDF)
                </a>
                {isAdmin && bon.email && (
                  <button
                    onClick={() => setModaleRapportOuverte(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                    Envoyer le rapport au client
                  </button>
                )}
              </div>
              {isAdmin && infosVisite.relevesEnAttente > 0 && (
                <BoutonRattacher biId={bon.id} enAttente={infosVisite.relevesEnAttente} />
              )}
            </Section>
          )}
          {isAdmin && (
            <>
              {bon.pole === Poles.entretienSousContrat ? (
                <Section titre="Classement">
                  <p className="text-sm text-slate-700">Maintenance (forfait entretien)</p>
                </Section>
              ) : (
                <>
                  {!sansMontant(bon.pole) && <BlocMontantFacturation bon={bon} tauxSite={tauxSite} />}
                  <BlocClassement bon={bon} />
                </>
              )}
            </>
          )}
          <BlocHistorique bon={bon} />
        </div>
      )}

      {modaleRapportOuverte && (
        <ModaleEmail biId={bon.id} destinataire={bon.email} rapport onClose={() => setModaleRapportOuverte(false)} />
      )}
      {modaleEmailOuverte && (
        <ModaleEmail biId={bon.id} destinataire={bon.email} onClose={() => setModaleEmailOuverte(false)} />
      )}
    </div>
  );
}

function BlocClient({ bon }: { bon: Bon }) {
  return (
    <Section titre="Le client">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} />
        Données client et signature verrouillées après signature.
      </div>
      <Ligne label="Client" valeur={[bon.client_nom, bon.site].filter(Boolean).join(" — ")} />
      <Ligne label="Adresse" valeur={bon.adresse || "—"} />
      {bon.hors_contrat && <Ligne label="⚑" valeur="Client hors contrat" />}
      <Ligne label="Signataire" valeur={`${bon.signataire}  ·  ${bon.date_signature}`} />
    </Section>
  );
}

function BlocHistorique({ bon }: { bon: Bon }) {
  if (!Array.isArray(bon.history) || bon.history.length === 0) return null;
  return (
    <Section titre="Historique des corrections">
      {(bon.history as { user?: string; date?: string; event?: string; changes?: { champ: string; avant: string; apres: string }[] }[]).map(
        (h, i) => (
          <div key={i} className="mb-2">
            <p className="text-xs font-bold text-slate-700">
              {h.date} · {h.user}
            </p>
            {h.event && <p className="text-sm text-slate-600">{h.event}</p>}
            {h.changes?.map((c, j) => (
              <p key={j} className="text-xs text-slate-500">
                • {c.champ} : « {c.avant} » → « {c.apres} »
              </p>
            ))}
          </div>
        ),
      )}
    </Section>
  );
}

function ModaleEmail({
  biId,
  destinataire,
  onClose,
  rapport,
}: {
  biId: string;
  destinataire: string;
  onClose: () => void;
  /// true : envoie le rapport technique de la visite au lieu du BI.
  rapport?: boolean;
}) {
  const router = useRouter();
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Envoyer à {destinataire}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          {rapport
            ? "Le rapport technique de la visite (PDF) sera joint à l'email."
            : "Le PDF du bon d'intervention sera joint à l'email."}
        </p>
        <textarea
          value={info}
          onChange={(e) => setInfo(e.target.value)}
          rows={3}
          placeholder="Information complémentaire (optionnel)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
        />
        {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                const res = rapport ? await envoyerRapportParEmail(biId, info) : await envoyerBiParEmail(biId, info);
                if (!res.ok) {
                  setErreur(res.erreur);
                  return;
                }
                onClose();
                router.refresh();
              })
            }
            disabled={pending}
            className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-60"
          >
            {pending ? "Envoi..." : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VueLectureSeule({
  bon,
  typesEquipement,
  modele,
}: {
  bon: Bon;
  typesEquipement: TypeEquipementResume[];
  modele: ModeleResume;
}) {
  const interventions = interventionsDuBon(bon);
  const multiEquipement = interventions.length > 1;
  const prestas = (bon.prestas as { designation: string; quantite: string; pu?: string }[]).filter((p) => p.designation.trim());
  const total = totalHT(prestas);
  const nonDesservis = bon.entretien_non_desservis as { nom?: string; motif?: string }[];
  const photos = bon.photos as { type: string; storage_path: string; horodatage: string }[];
  const type = typesEquipement.find((t) => t.id === bon.materiel_type_equipement_id);

  return (
    <>
      <Section titre="Intervention">
        <Ligne label="Pôle" valeur={`${bon.pole} · ${labelPole(bon.pole)}`} />
        <Ligne label="Technicien(s)" valeur={bon.techniciens.join(", ")} />
        {bon.devis_numero && <Ligne label="Affaire" valeur={bon.devis_numero} />}
        {bon.devis_reference_client && <Ligne label="Réf. client" valeur={bon.devis_reference_client} />}
        {!multiEquipement && bon.equipement_nom && <Ligne label="Équipement" valeur={equipementLabel(bon)} />}
        {bon.entretien_groupes.length > 0 && <Ligne label="Groupes entretenus" valeur={bon.entretien_groupes.join(", ")} />}
        {avecPeriode(bon.pole) ? (
          <Ligne
            label="Période"
            valeur={bon.date_debut && bon.date_fin && bon.date_debut !== bon.date_fin ? `du ${bon.date_debut} au ${bon.date_fin}` : bon.date_debut || "—"}
          />
        ) : (
          <>
            <Ligne label="Date d'intervention" valeur={bon.date_intervention || "—"} />
            <Ligne label="Temps passé" valeur={bon.temps_passe || "—"} />
          </>
        )}
        {!avecPeriode(bon.pole) && <Ligne label="Nombre de déplacements" valeur={String(bon.nombre_deplacements)} />}
      </Section>

      {(bon.materiel_champs_en_tete as Record<string, unknown>) &&
        Object.keys(bon.materiel_champs_en_tete as Record<string, unknown>).length > 0 && (
          <Section titre="Caractéristiques du matériel">
            {Object.entries(bon.materiel_champs_en_tete as Record<string, string>)
              .filter(([cle, v]) => !CHAMPS_MATERIEL_EXCLUS_BI.has(cle) && v && String(v).trim())
              .map(([cle, v]) => (
                <Ligne key={cle} label={labelChampMateriel(type, cle)} valeur={String(v)} />
              ))}
          </Section>
        )}

      {modele && modele.champs.length > 0 && (
        <Section titre="Champs guidés">
          {modele.champs.map((c) => {
            const v = (bon.modele_champs as Record<string, string>)[c.cle];
            return v ? <Ligne key={c.cle} label={c.label} valeur={v} /> : null;
          })}
        </Section>
      )}

      {modele && modele.checklist.length > 0 && (
        <Section titre="Checklist">
          {modele.checklist.map((item) => {
            const v = (bon.checklist_values as Record<string, boolean | string>)[item.rep];
            return (
              <Ligne
                key={item.rep}
                label={`${item.rep}. ${item.label}`}
                valeur={v === true ? "Effectué" : v === false || v === undefined ? "—" : String(v)}
              />
            );
          })}
        </Section>
      )}

      {!multiEquipement && (
        <Section titre="Compte rendu">
          {(bon.etat_equipement as string[] | null) && (bon.etat_equipement as string[]).length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {(bon.etat_equipement as string[]).map((e) => (
                <span key={e} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                  {ETATS_EQUIPEMENT[e] ?? e}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-700">{bon.compte_rendu || "—"}</p>
        </Section>
      )}

      {nonDesservis.length > 0 && (
        <Section titre="Équipements non entretenus">
          {nonDesservis.map((e, i) => (
            <Ligne key={i} label={e.nom ?? ""} valeur={e.motif ?? ""} />
          ))}
        </Section>
      )}

      {multiEquipement &&
        interventions.map((inter, i) => {
          const totalInter = totalHT(inter.prestas);
          const prestasInter = inter.prestas.filter((p) => p.designation.trim());
          const label = equipementLabel({ pole: bon.pole, ...inter });
          return (
            <Section
              key={i}
              titre={`${bon.pole === POLE_PLUSIEURS_TYPES ? `${labelPole(inter.pole ?? "")} — ` : ""}${
                label ? `Équipement : ${label}` : `Intervention ${i + 1}`
              }`}
            >
              {inter.etat_equipement.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {inter.etat_equipement.map((e) => (
                    <span key={e} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      {ETATS_EQUIPEMENT[e] ?? e}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-slate-700">{inter.compte_rendu || "—"}</p>
              {prestasInter.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {prestasInter.map((p, j) => (
                    <Ligne
                      key={j}
                      label={p.designation}
                      valeur={`× ${p.quantite}   Montant ${montantLigne(p) !== null ? eur(montantLigne(p)!) : "—"}`}
                    />
                  ))}
                  {totalInter > 0 && <Ligne label="Total HT" valeur={eur(totalInter)} />}
                </div>
              )}
            </Section>
          );
        })}

      {!multiEquipement && prestas.length > 0 && (
        <Section titre="Prestations & fournitures">
          {prestas.map((p, i) => (
            <Ligne
              key={i}
              label={p.designation}
              valeur={`× ${p.quantite}   Montant ${montantLigne(p) !== null ? eur(montantLigne(p)!) : "—"}`}
            />
          ))}
          {total > 0 && <Ligne label="Total HT" valeur={eur(total)} />}
        </Section>
      )}

      {photos.length > 0 && (
        <Section titre="Photos">
          <div className="flex flex-wrap gap-2.5">
            {photos.map((p, i) => (
              <PhotoVignette key={i} photo={p} />
            ))}
          </div>
        </Section>
      )}

      {bon.obs_tech && (
        <Section titre="Observation technicien">
          <p className="text-sm text-slate-700">{bon.obs_tech}</p>
        </Section>
      )}
      {bon.obs_client && (
        <Section titre="Observation client">
          <p className="text-sm text-slate-700">{bon.obs_client}</p>
        </Section>
      )}
    </>
  );
}

/// Une fois le BI vérifié : le bureau choisit s'il part à l'archivage
/// chantier (rien à facturer) ou à facturer — avec les taux du site
/// (Répertoire) affichés pour vérifier avant de cocher, et le mois de
/// facturation une fois "À facturer" coché (même principe que les
/// devis : mention "Facturable" dès que le mois est renseigné).
/// Montant estimé à facturer — toujours au taux horaire régie (pas le
/// taux vendu, affiché juste pour référence), + forfait déplacement et
/// matériel, pour que le bureau voie le total avant de cocher "À
/// facturer".
function BlocMontantFacturation({ bon, tauxSite }: { bon: Bon; tauxSite: TauxSiteComplet }) {
  const montantHeures = montantMainDoeuvre(bon.temps_passe, tauxSite);
  const montantDepl = montantDeplacements(bon.nombre_deplacements, tauxSite);
  const prestas = interventionsDuBon(bon).flatMap((i) => i.prestas.filter((p: Presta) => p.designation.trim()));
  const montantMateriel = totalHT(prestas);
  const total = (montantHeures ?? 0) + (montantDepl ?? 0) + montantMateriel;

  return (
    <Section titre="Montant à facturer">
      <div className="space-y-0.5">
        <Ligne label="Temps passé" valeur={bon.temps_passe || "—"} />
        {tauxSite ? (
          <>
            <Ligne label="Taux horaire régie" valeur={tauxSite.taux_horaire_regie ? `${tauxSite.taux_horaire_regie} €/h` : "—"} />
            {montantHeures !== null && <Ligne label="→ Montant main d'œuvre" valeur={eur(montantHeures)} />}
            <Ligne
              label="Forfait déplacement"
              valeur={tauxSite.forfait_deplacement ? `${tauxSite.forfait_deplacement} € × ${bon.nombre_deplacements}` : "—"}
            />
            {montantDepl !== null && <Ligne label="→ Montant déplacements" valeur={eur(montantDepl)} />}
          </>
        ) : (
          <p className="text-sm text-slate-400">Aucun taux connu pour ce client (fiche site).</p>
        )}
        {montantMateriel > 0 && <Ligne label="Matériel / fournitures" valeur={eur(montantMateriel)} />}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2">
        <span className="text-sm font-bold text-slate-900">Total estimé</span>
        <span className="text-lg font-bold text-slate-900">{eur(total)}</span>
      </div>
    </Section>
  );
}

function BlocClassement({
  bon,
  onChange,
  onMoisChange,
}: {
  bon: Bon;
  onChange?: (classement: string) => void;
  onMoisChange?: (mois: string) => void;
}) {
  const router = useRouter();
  const [classement, setClassement] = useState(bon.classement);
  const [moisFacturation, setMoisFacturation] = useState(bon.mois_facturation);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(valeur: string) {
    setErreur(null);
    const nouveau = classement === valeur ? "" : valeur;
    startTransition(async () => {
      const res = await classerBI(bon.id, nouveau, nouveau === "facturer" ? moisFacturation : "");
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setClassement(nouveau);
      onChange?.(nouveau);
      router.refresh();
    });
  }

  function enregistrerMois() {
    setErreur(null);
    startTransition(async () => {
      const res = await classerBI(bon.id, "facturer", moisFacturation.trim());
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Section titre="Classement">
      <div id="bi-classement" className="flex flex-wrap gap-4">
        {Object.entries(CLASSEMENT_LABELS).map(([valeur, label]) => (
          <label key={valeur} className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={classement === valeur}
              onChange={() => choisir(valeur)}
              disabled={pending}
              className="h-4 w-4 accent-brand-green"
            />
            {label}
          </label>
        ))}
      </div>

      {classement === "facturer" && (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Mois de facturation (MM-AAAA)</label>
            <input
              id="bi-mois"
              value={moisFacturation}
              onChange={(e) => {
                setMoisFacturation(e.target.value);
                onMoisChange?.(e.target.value);
              }}
              placeholder="10-2026"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            />
          </div>
          <button
            onClick={enregistrerMois}
            disabled={pending || moisFacturation === bon.mois_facturation}
            className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? "..." : "Enregistrer"}
          </button>
        </div>
      )}
      {classement === "facturer" && bon.mois_facturation && (
        <p className="mt-2 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">Facturable</p>
      )}
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
    </Section>
  );
}

/// Main d'œuvre + déplacement estimés, affichés uniquement au bureau
/// quand le classement "À Facturer" est choisi — jamais sur le PDF
/// client (voir genererPdfBI, TablePrestas n'imprime ni PU ni montant).
function BlocMainDoeuvreDeplacement({
  tempsPasse,
  nombreDeplacements,
  tauxSite,
}: {
  tempsPasse: string;
  nombreDeplacements: number;
  tauxSite: TauxSiteComplet;
}) {
  if (!tauxSite) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Aucun taux connu pour ce client (fiche site) — main d&apos;œuvre et déplacement non estimables.
      </p>
    );
  }
  const mo = montantMainDoeuvre(tempsPasse, tauxSite);
  const depl = montantDeplacements(nombreDeplacements, tauxSite);
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        Facturation (interne, jamais imprimée)
      </p>
      <div className="grid grid-cols-2 gap-y-1 text-sm">
        <span className="text-slate-500">Main d&apos;œuvre</span>
        <span className="text-right font-medium text-slate-900">
          {mo !== null ? `${eur(mo)}  (${tauxSite.taux_horaire_regie} €/h)` : "—"}
        </span>
        <span className="text-slate-500">Déplacement × {nombreDeplacements}</span>
        <span className="text-right font-medium text-slate-900">
          {depl !== null ? `${eur(depl)}  (${tauxSite.forfait_deplacement} €)` : "—"}
        </span>
      </div>
    </div>
  );
}

function labelChampMateriel(type: TypeEquipementResume | undefined, cle: string): string {
  const champs = (type?.champs_en_tete_supplementaires as { cle: string; label: string }[] | undefined) ?? [];
  return champs.find((c) => c.cle === cle)?.label ?? cle;
}

function PhotoVignette({ photo }: { photo: { type: string; storage_path: string; horodatage: string } }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    urlPhotoSignee(photo.storage_path).then(setUrl);
  }, [photo.storage_path]);

  return (
    <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" className="block">
      <div className="h-24 w-24 overflow-hidden rounded-xl bg-slate-100">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- vignette servie via une URL signée temporaire, pas un asset local
          <img src={url} alt="" className="h-24 w-24 object-cover" />
        )}
      </div>
      <p className="mt-1 text-center text-[10px] text-slate-500">{PHOTO_TYPES[photo.type] ?? photo.type}</p>
    </a>
  );
}

/// Suggère le prochain numéro libre (3ème partie, ex: "405-02-13")
/// pour un équipement installé via BI — Numéro Client-Numéro Site
/// toujours dérivé du site, jamais saisi.
function VueCorrection({
  bon,
  techniciensDisponibles,
  tauxSite,
  numeroAffaireSite,
  numerosEquipementSite,
  infosVisite,
  onValide,
}: {
  bon: Bon;
  techniciensDisponibles: string[];
  tauxSite: TauxSiteComplet;
  numeroAffaireSite: string;
  numerosEquipementSite: string[];
  infosVisite: InfosVisite | null;
  onValide: () => void;
}) {
  const [pole, setPole] = useState(bon.pole);
  const [visiteNumero, setVisiteNumero] = useState(String(bon.visite_numero ?? infosVisite?.proposition.numero ?? ""));
  const [visiteTotal, setVisiteTotal] = useState(String(bon.visite_total ?? infosVisite?.proposition.total ?? ""));
  const [visiteAnnee, setVisiteAnnee] = useState(String(bon.visite_annee ?? infosVisite?.proposition.annee ?? ""));
  const avecVisite = pole === Poles.entretienSousContrat;
  const [techniciens, setTechniciens] = useState<string[]>(bon.techniciens);
  const [dateDebut, setDateDebut] = useState(bon.date_debut);
  const [dateFin, setDateFin] = useState(bon.date_fin);
  const [dateIntervention, setDateIntervention] = useState(bon.date_intervention);
  const [tempsPasse, setTempsPasse] = useState(bon.temps_passe);
  const [nombreDeplacements, setNombreDeplacements] = useState(bon.nombre_deplacements);
  const [obsTech, setObsTech] = useState(bon.obs_tech);
  const [classementActuel, setClassementActuel] = useState(bon.classement);
  const [moisActuel, setMoisActuel] = useState(bon.mois_facturation);
  const [equipementNom, setEquipementNom] = useState(bon.equipement_nom);
  const [equipementNumero, setEquipementNumero] = useState(
    () => bon.equipement_numero || suggererNumeroEquipement(numeroAffaireSite, numerosEquipementSite),
  );
  const [interventions, setInterventions] = useState<InterventionEquipement[]>(() => {
    // Installation neuve à plusieurs équipements : un numéro libre suggéré
    // pour chacun, sans jamais proposer deux fois le même.
    const numerosPris = [...numerosEquipementSite, equipementNumero];
    return interventionsDuBon(bon).map((inter, i) => {
      const nettoyee = { ...inter, prestas: inter.prestas.filter((p) => p.designation.trim()) };
      if (i === 0 || (inter.pole ?? bon.pole) !== Poles.installationNeuve) return nettoyee;
      const numero = inter.equipement_numero || suggererNumeroEquipement(numeroAffaireSite, numerosPris);
      numerosPris.push(numero);
      return { ...nettoyee, equipement_numero: numero };
    });
  });
  const [noteInterne, setNoteInterne] = useState(bon.note_interne);
  const [email, setEmail] = useState(bon.email);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const emailValide = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  // Sur un BI à plusieurs pages, chaque page a son propre type.
  const poleDe = (i: number) => (pole === POLE_PLUSIEURS_TYPES ? (interventions[i]?.pole ?? "") : pole);
  const posesSupplementaires = interventions.slice(1).filter((_, j) => poleDe(j + 1) === Poles.installationNeuve);
  const numerosPoses = [
    ...(poleDe(0) === Poles.installationNeuve ? [equipementNumero] : []),
    ...posesSupplementaires.map((p) => p.equipement_numero ?? ""),
  ].map((n) => n.trim());
  const numeroEnDouble = (numero: string) =>
    numerosEquipementSite.includes(numero.trim()) || numerosPoses.filter((n) => n === numero.trim()).length > 1;
  const classementFinal = pole === Poles.entretienSousContrat ? "maintenance" : classementActuel;
  const moisRenseigne = classementFinal !== "facturer" || /^\d{2}-\d{4}$/.test(moisActuel.trim());
  const { signaler, fenetre } = useChampManquant();

  function manquePourValider(): [string, CibleChamp] | null {
    if (avecVisite) {
      const total = Number(visiteTotal);
      if (!Number.isInteger(total) || total < 1 || total > 12) return ["Indique le nombre de visites par an (1 à 12)", "bi-visite-total"];
      const numero = Number(visiteNumero);
      if (!Number.isInteger(numero) || numero < 1 || numero > total) return [`Indique le n° de la visite (1 à ${total})`, "bi-visite-numero"];
      const annee = Number(visiteAnnee);
      if (!Number.isInteger(annee) || annee < 2020 || annee > 2100) return ["Indique l'année du contrat (ex : 2026)", "bi-visite-annee"];
    }
    if (poleDe(0) === Poles.installationNeuve) {
      if (bon.materiel_type_equipement_id === null) return ["Le type d'équipement posé n'est pas renseigné sur ce BI", null];
      if (!equipementNom.trim()) return ["Renseigne le nom de l'équipement", "bi-eq-nom"];
      if (!equipementNumero.trim()) return ["Renseigne le numéro d'équipement", "bi-eq-numero"];
      if (numeroEnDouble(equipementNumero)) return ["Ce numéro d'équipement est déjà utilisé : choisis-en un autre", "bi-eq-numero"];
    }
    for (const [j, p] of interventions.entries()) {
      if (j === 0 || poleDe(j) !== Poles.installationNeuve) continue;
      if (!p.equipement_nom.trim()) return ["Renseigne le nom de l'équipement posé", `bi-eq-nom-${j}`];
      if (!(p.equipement_numero ?? "").trim()) return ["Renseigne le numéro de l'équipement posé", `bi-eq-numero-${j}`];
      if (numeroEnDouble(p.equipement_numero ?? "")) return ["Ce numéro d'équipement est déjà utilisé : choisis-en un autre", `bi-eq-numero-${j}`];
    }
    if (classementFinal === "") return ["Choisis un classement", "bi-classement"];
    if (!moisRenseigne) return ["Saisis le mois de facturation au format MM-AAAA (ex : 10-2026)", "bi-mois"];
    if (!emailValide) return [email.trim() ? "L'email du client n'est pas valide" : "Renseigne l'email du client", "bi-email"];
    return null;
  }

  function valider() {
    setErreur(null);
    const manque = manquePourValider();
    if (manque) {
      signaler(manque[0], manque[1]);
      return;
    }
    const input: CorrectionInput = {
      pole,
      techniciens,
      date_debut: dateDebut,
      date_fin: dateFin,
      date_intervention: dateIntervention,
      temps_passe: tempsPasse,
      nombre_deplacements: nombreDeplacements,
      compte_rendu: interventions[0]?.compte_rendu ?? "",
      obs_tech: obsTech,
      note_interne: noteInterne,
      email,
      prestas: interventions[0]?.prestas ?? [],
      etat_equipement: interventions[0]?.etat_equipement ?? [],
      interventions_supplementaires: interventions.slice(1),
      equipement_nom: poleDe(0) === Poles.installationNeuve ? equipementNom.trim() : bon.equipement_nom,
      equipement_numero: poleDe(0) === Poles.installationNeuve ? equipementNumero.trim() : bon.equipement_numero,
      mois_facturation: classementFinal === "facturer" ? moisActuel.trim() : "",
      visite: avecVisite
        ? { numero: Number(visiteNumero), total: Number(visiteTotal), annee: Number(visiteAnnee) }
        : null,
    };
    startTransition(async () => {
      const res = await validerBI(bon.id, bon, input);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      onValide();
    });
  }

  return (
    <Section titre="Vérification & correction (bureau)">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Pôle</label>
          {pole === POLE_PLUSIEURS_TYPES ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Plusieurs types — une page par type :{" "}
              {interventions.map((inter) => labelPole(inter.pole ?? "")).join(", ")}
            </p>
          ) : (
            <select
              value={pole}
              onChange={(e) => setPole(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            >
              {Object.values(Poles).map((code) => (
                <option key={code} value={code}>
                  Pôle {code} · {labelPole(code)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Techniciens</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {techniciens.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {t}
                <button onClick={() => setTechniciens((prev) => prev.filter((x) => x !== t))}>
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
          {(
            <select
              value=""
              onChange={(e) => e.target.value && setTechniciens((prev) => [...prev, e.target.value])}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
            >
              <option value="">+ Ajouter un intervenant</option>
              {techniciensDisponibles
                .filter((t) => !techniciens.includes(t))
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          )}
        </div>

        {avecPeriode(pole) ? (
          <div className="grid grid-cols-2 gap-2">
            <ChampDate label="Date de début" valeur={dateDebut} onChange={setDateDebut} />
            <ChampDate label="Date de fin" valeur={dateFin} onChange={setDateFin} />
          </div>
        ) : (
          <ChampDate label="Date d'intervention" valeur={dateIntervention} onChange={setDateIntervention} />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Champ label="Temps passé" valeur={tempsPasse} onChange={setTempsPasse} />
          <Champ
            label="Nombre de déplacements"
            valeur={String(nombreDeplacements)}
            onChange={(v) => setNombreDeplacements(Math.max(1, parseInt(v, 10) || 1))}
          />
        </div>

        {poleDe(0) === Poles.installationNeuve && (
          <>
            <Champ id="bi-eq-nom" label="Nom de l'équipement" valeur={equipementNom} onChange={setEquipementNom} />
            <div>
              <Champ id="bi-eq-numero" label="Numéro d'équipement" valeur={equipementNumero} onChange={setEquipementNumero} />
              {numeroEnDouble(equipementNumero) && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  Ce numéro existe déjà sur ce site — choisis-en un autre.
                </p>
              )}
              {numerosEquipementSite.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Déjà utilisés sur ce site : {numerosEquipementSite.slice().sort().join(", ")}
                </p>
              )}
            </div>
          </>
        )}

        {interventions.map((inter, i) => {
          const label = equipementLabel({ pole, ...inter });
          function majIntervention(champs: Partial<InterventionEquipement>) {
            setInterventions((prev) => prev.map((ligne, j) => (j === i ? { ...ligne, ...champs } : ligne)));
          }
          return (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {label ? `Équipement : ${label}` : interventions.length > 1 ? `Intervention ${i + 1}` : "Compte rendu"}
              </p>
              {i > 0 && poleDe(i) === Poles.installationNeuve && (
                <div className="mb-3 space-y-2">
                  <Champ
                    id={`bi-eq-nom-${i}`}
                    label="Nom de l'équipement"
                    valeur={inter.equipement_nom}
                    onChange={(v) => majIntervention({ equipement_nom: v })}
                  />
                  <Champ
                    id={`bi-eq-numero-${i}`}
                    label="Numéro d'équipement"
                    valeur={inter.equipement_numero ?? ""}
                    onChange={(v) => majIntervention({ equipement_numero: v })}
                  />
                  {numeroEnDouble(inter.equipement_numero ?? "") && (
                    <p className="text-xs font-semibold text-red-600">Ce numéro est déjà utilisé — choisis-en un autre.</p>
                  )}
                </div>
              )}
              {inter.etat_equipement.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {inter.etat_equipement.map((e) => (
                    <span key={e} className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      {ETATS_EQUIPEMENT[e] ?? e}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                value={inter.compte_rendu}
                onChange={(e) => majIntervention({ compte_rendu: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
              />
              {inter.prestas.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-slate-50 px-3 py-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fourniture de matériel</p>
                    <p className="text-[11px] text-slate-400">Prix à saisir par le bureau</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {inter.prestas.map((p, j) => (
                      <div key={j} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{p.designation}</p>
                          <p className="text-xs text-slate-400">× {p.quantite}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <input
                            value={p.pu ?? ""}
                            onChange={(e) =>
                              majIntervention({
                                prestas: inter.prestas.map((ligne, k) => (k === j ? { ...ligne, pu: e.target.value } : ligne)),
                              })
                            }
                            placeholder="0,00"
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-violet-600"
                          />
                          <span className="text-xs text-slate-400">€</span>
                        </div>
                        <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-700">
                          {montantLigne(p) !== null ? eur(montantLigne(p)!) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalHT(inter.prestas) > 0 && (
                    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-sm font-bold text-slate-900">Total HT</span>
                      <span className="text-sm font-bold text-slate-900">{eur(totalHT(inter.prestas))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {avecVisite && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-teal-700">Visite d&apos;entretien</p>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <span className="pb-2 text-slate-600">Visite n°</span>
              <input
                id="bi-visite-numero"
                value={visiteNumero}
                onChange={(e) => setVisiteNumero(e.target.value)}
                inputMode="numeric"
                className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
              />
              <span className="pb-2 text-slate-600">de</span>
              <input
                id="bi-visite-total"
                value={visiteTotal}
                onChange={(e) => setVisiteTotal(e.target.value)}
                inputMode="numeric"
                className="w-14 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
              />
              <span className="pb-2 text-slate-600">— année</span>
              <input
                id="bi-visite-annee"
                value={visiteAnnee}
                onChange={(e) => setVisiteAnnee(e.target.value)}
                inputMode="numeric"
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm outline-none focus:border-violet-600"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Pré-rempli d&apos;après les visites déjà validées. Une visite faite en janvier peut être rattachée à
              l&apos;année précédente.
            </p>
            {infosVisite && <RelevesDeLaVisite equipements={infosVisite.equipements} />}
          </div>
        )}

        {pole === Poles.entretienSousContrat ? (
          <p className="text-sm text-slate-600">
            <span className="font-semibold">Classement :</span> Maintenance (forfait entretien)
          </p>
        ) : (
          <BlocClassement bon={bon} onChange={setClassementActuel} onMoisChange={setMoisActuel} />
        )}
        {classementFinal === "facturer" && !sansMontant(pole) && (
          <BlocMainDoeuvreDeplacement tempsPasse={tempsPasse} nombreDeplacements={nombreDeplacements} tauxSite={tauxSite} />
        )}
        {classementFinal === "" && (
          <p className="text-xs font-medium text-amber-600">Choisis un classement ci-dessus avant de valider.</p>
        )}
        {!moisRenseigne && (
          <p className="text-xs font-medium text-amber-600">
            Saisis le mois de facturation au format MM-AAAA (ex : 10-2026) avant de valider.
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Observations technicien</label>
          <textarea
            value={obsTech}
            onChange={(e) => setObsTech(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Remarque interne (non imprimée)</label>
          <textarea
            value={noteInterne}
            onChange={(e) => setNoteInterne(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Email du client</label>
          <input
            id="bi-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
          />
        </div>
      </div>

      {erreur && <p className="mt-3 text-sm text-red-600">{erreur}</p>}

      <button
        onClick={valider}
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "Validation..." : "✓ Valider"}
      </button>
      {fenetre}
    </Section>
  );
}

function BoutonRattacher({ biId, enAttente }: { biId: string; enAttente: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await rattacherRelevesEnAttente(biId);
            setMessage(res.ok ? `${res.nombre ?? 0} relevé(s) rattaché(s).` : res.erreur);
            router.refresh();
          })
        }
        className="rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
      >
        {pending ? "Rattachement..." : `Rattacher les relevés en attente (${enAttente})`}
      </button>
      {message && <span className="text-xs text-slate-600">{message}</span>}
    </div>
  );
}

/// Équipements entretenus avec ou sans relevé technique — la visite compte
/// pour tous, l'alerte n'est qu'une information.
function RelevesDeLaVisite({
  equipements,
  rattaches,
}: {
  equipements: { nom: string; avecReleve: boolean }[];
  rattaches?: boolean;
}) {
  if (equipements.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">Aucun équipement dans les groupes cochés.</p>;
  }
  const sansReleve = equipements.filter((e) => !e.avecReleve);
  const nbAvec = equipements.length - sansReleve.length;
  return (
    <div className="mt-2 space-y-1.5 text-xs">
      <p className="font-semibold text-slate-700">
        {nbAvec} / {equipements.length} équipement(s) avec relevé technique{" "}
        {rattaches ? "rattaché à cette visite" : "en attente (rattachés à la validation)"}
      </p>
      {sansReleve.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
          Sans relevé technique ({sansReleve.length}) : {sansReleve.map((e) => e.nom).join(", ")} — la visite compte
          quand même pour eux.
        </p>
      )}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-bold text-slate-900">{titre}</p>
      {children}
    </div>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-36 shrink-0 font-semibold text-slate-500">{label}</span>
      <span className="text-slate-800">{valeur}</span>
    </div>
  );
}

/// Date stockée "jj/mm/aaaa", saisie avec le calendrier du navigateur.
function ChampDate({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="date"
        value={dateFrVersIso(valeur)}
        onChange={(e) => onChange(formaterDate(e.target.value))}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
      />
    </div>
  );
}

function Champ({ id, label, valeur, onChange }: { id?: string; label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        id={id}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
      />
    </div>
  );
}
