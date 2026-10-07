"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, X, FileText, ExternalLink, Mail } from "lucide-react";
import type { Tables } from "@/lib/types";
import { StatutBadge } from "@/components/bi/statut-badge";
import { Poles, Statuts, avecPeriode, sansTempsPasse, labelPole, PHOTO_TYPES, CHAMPS_MATERIEL_EXCLUS_BI } from "@/lib/bi/constants";
import { equipementLabel, eur, montantLigne, totalHT, interventionsDuBon, type InterventionEquipement } from "@/lib/bi/format";
import { validerBI, urlPhotoSignee, urlArchiveSignee, envoyerBiParEmail, type CorrectionInput } from "./actions";
import type { ChampEnTete, ChecklistItem } from "@/lib/gmao/types";

const STATUTS_AVEC_PDF = new Set<string>([Statuts.valide, Statuts.pdfGenere, Statuts.pretEnvoi, Statuts.envoye]);

type Bon = Tables<"bons_intervention">;
type TypeEquipementResume = { id: string; nom: string; champs_en_tete_supplementaires: unknown };
type ModeleResume = { champs: ChampEnTete[]; checklist: ChecklistItem[] } | null;

export function BiDetail({
  bon,
  techniciensDisponibles,
  typesEquipement,
  modele,
  isAdmin,
}: {
  bon: Bon;
  techniciensDisponibles: string[];
  typesEquipement: TypeEquipementResume[];
  modele: ModeleResume;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const enCorrection = isAdmin && bon.statut === Statuts.aVerifier;
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [modaleEmailOuverte, setModaleEmailOuverte] = useState(false);

  useEffect(() => {
    if (bon.pdf_storage_path) urlArchiveSignee(bon.pdf_storage_path).then(setArchiveUrl);
  }, [bon.pdf_storage_path]);

  return (
    <div className="mx-auto max-w-2xl">
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

      {enCorrection ? (
        <VueCorrection bon={bon} techniciensDisponibles={techniciensDisponibles} onValide={() => router.refresh()} />
      ) : (
        <VueLectureSeule bon={bon} typesEquipement={typesEquipement} modele={modele} />
      )}

      {Array.isArray(bon.history) && bon.history.length > 0 && (
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
      )}

      {modaleEmailOuverte && (
        <ModaleEmail biId={bon.id} destinataire={bon.email} onClose={() => setModaleEmailOuverte(false)} />
      )}
    </div>
  );
}

function ModaleEmail({
  biId,
  destinataire,
  onClose,
}: {
  biId: string;
  destinataire: string;
  onClose: () => void;
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
        <p className="mb-3 text-xs text-slate-500">Le PDF du bon d&apos;intervention sera joint à l&apos;email.</p>
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
                const res = await envoyerBiParEmail(biId, info);
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
            {!sansTempsPasse(bon.pole) && <Ligne label="Temps passé" valeur={bon.temps_passe || "—"} />}
          </>
        )}
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
            <Section key={i} titre={label ? `Équipement : ${label}` : `Intervention ${i + 1}`}>
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

function VueCorrection({
  bon,
  techniciensDisponibles,
  onValide,
}: {
  bon: Bon;
  techniciensDisponibles: string[];
  onValide: () => void;
}) {
  const [pole, setPole] = useState(bon.pole);
  const [techniciens, setTechniciens] = useState<string[]>(bon.techniciens);
  const [dateDebut, setDateDebut] = useState(bon.date_debut);
  const [dateFin, setDateFin] = useState(bon.date_fin);
  const [dateIntervention, setDateIntervention] = useState(bon.date_intervention);
  const [tempsPasse, setTempsPasse] = useState(bon.temps_passe);
  const [obsTech, setObsTech] = useState(bon.obs_tech);
  const [interventions, setInterventions] = useState<InterventionEquipement[]>(() =>
    interventionsDuBon(bon).map((inter) => ({ ...inter, prestas: inter.prestas.filter((p) => p.designation.trim()) })),
  );
  const [noteInterne, setNoteInterne] = useState(bon.note_interne);
  const [email, setEmail] = useState(bon.email);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const emailValide = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const peutValider =
    emailValide && (pole !== Poles.installationNeuve || (bon.equipement_nom.trim() !== "" && bon.materiel_type_equipement_id !== null));

  function valider() {
    setErreur(null);
    const input: CorrectionInput = {
      pole,
      techniciens,
      date_debut: dateDebut,
      date_fin: dateFin,
      date_intervention: dateIntervention,
      temps_passe: tempsPasse,
      compte_rendu: interventions[0]?.compte_rendu ?? "",
      obs_tech: obsTech,
      note_interne: noteInterne,
      email,
      prestas: interventions[0]?.prestas ?? [],
      interventions_supplementaires: interventions.slice(1),
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
        </div>

        {avecPeriode(pole) ? (
          <div className="grid grid-cols-2 gap-2">
            <Champ label="Date de début" valeur={dateDebut} onChange={setDateDebut} />
            <Champ label="Date de fin" valeur={dateFin} onChange={setDateFin} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Champ label="Date d'intervention" valeur={dateIntervention} onChange={setDateIntervention} />
            {!sansTempsPasse(pole) && <Champ label="Temps passé" valeur={tempsPasse} onChange={setTempsPasse} />}
          </div>
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
              <textarea
                value={inter.compte_rendu}
                onChange={(e) => majIntervention({ compte_rendu: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
              />
              {inter.prestas.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium text-slate-600">
                    Fourniture de matériel — prix à saisir par le bureau
                  </p>
                  <div className="space-y-2">
                    {inter.prestas.map((p, j) => (
                      <div key={j} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                        <div className="min-w-0 flex-1 text-sm text-slate-700">
                          {p.designation} <span className="text-slate-400">× {p.quantite}</span>
                        </div>
                        <input
                          value={p.pu ?? ""}
                          onChange={(e) =>
                            majIntervention({
                              prestas: inter.prestas.map((ligne, k) => (k === j ? { ...ligne, pu: e.target.value } : ligne)),
                            })
                          }
                          placeholder="PU €"
                          className="w-20 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-600"
                        />
                        <span className="w-20 shrink-0 text-right text-xs text-slate-500">
                          {montantLigne(p) !== null ? eur(montantLigne(p)!) : "—"}
                        </span>
                      </div>
                    ))}
                    {totalHT(inter.prestas) > 0 && (
                      <p className="text-right text-sm font-bold text-slate-900">Total HT : {eur(totalHT(inter.prestas))}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
        disabled={pending || !peutValider}
        className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
      >
        {pending ? "Validation..." : "✓ Valider"}
      </button>
    </Section>
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

function Champ({ label, valeur, onChange }: { label: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
      />
    </div>
  );
}
