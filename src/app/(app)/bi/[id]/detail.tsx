"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, X } from "lucide-react";
import type { Tables } from "@/lib/types";
import { StatutBadge } from "@/components/bi/statut-badge";
import { Poles, Statuts, avecPeriode, sansTempsPasse, labelPole, PHOTO_TYPES, CHAMPS_MATERIEL_EXCLUS_BI } from "@/lib/bi/constants";
import { equipementLabel, eur, montantLigne, totalHT } from "@/lib/bi/format";
import { validerBI, urlPhotoSignee, type CorrectionInput } from "./actions";

type Bon = Tables<"bons_intervention">;
type TypeEquipementResume = { id: string; nom: string; champs_en_tete_supplementaires: unknown };

export function BiDetail({
  bon,
  techniciensDisponibles,
  typesEquipement,
  isAdmin,
}: {
  bon: Bon;
  techniciensDisponibles: string[];
  typesEquipement: TypeEquipementResume[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const enCorrection = isAdmin && bon.statut === Statuts.aVerifier;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/bi"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-slate-900">{bon.numero || "BI (brouillon)"}</p>
        <StatutBadge statut={bon.statut} />
      </div>

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
        <VueLectureSeule bon={bon} typesEquipement={typesEquipement} />
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
    </div>
  );
}

function VueLectureSeule({ bon, typesEquipement }: { bon: Bon; typesEquipement: TypeEquipementResume[] }) {
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
        {bon.affaire_numero_devis && <Ligne label="Affaire" valeur={bon.affaire_numero_devis} />}
        {bon.affaire_numero_commande_client && <Ligne label="N° commande client" valeur={bon.affaire_numero_commande_client} />}
        {bon.equipement_nom && <Ligne label="Équipement" valeur={equipementLabel(bon)} />}
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

      <Section titre="Compte rendu">
        <p className="text-sm text-slate-700">{bon.compte_rendu || "—"}</p>
      </Section>

      {nonDesservis.length > 0 && (
        <Section titre="Équipements non entretenus">
          {nonDesservis.map((e, i) => (
            <Ligne key={i} label={e.nom ?? ""} valeur={e.motif ?? ""} />
          ))}
        </Section>
      )}

      {prestas.length > 0 && (
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
  const [compteRendu, setCompteRendu] = useState(bon.compte_rendu);
  const [obsTech, setObsTech] = useState(bon.obs_tech);
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
      compte_rendu: compteRendu,
      obs_tech: obsTech,
      note_interne: noteInterne,
      email,
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

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Compte rendu</label>
          <textarea
            value={compteRendu}
            onChange={(e) => setCompteRendu(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-600"
          />
        </div>
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
