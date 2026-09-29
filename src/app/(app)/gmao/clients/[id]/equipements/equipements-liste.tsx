"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Cog, QrCode, Eye, Play, Clock } from "lucide-react";
import type { Equipement, TypeEquipement, ReferenceHoraire } from "@/lib/gmao/types";
import { concatTypeEquipement, analyserReference } from "@/lib/gmao/suggestion-reference-horaire";
import { sommeHeuresAnnee, calculerHeuresVisite, type HeuresAnnee } from "@/lib/gmao/calcul-heures-visite";
import { VisiteChips } from "@/components/gmao/visite-chips";
import { BoutonSupprimer } from "@/components/bouton-supprimer";
import { supprimerEquipement } from "./actions";
import { QrDialog } from "./qr-dialog";

const COULEURS = [
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
];

function fmt(h: { heuresTech: number; heuresAssistant: number }): string {
  return `${h.heuresTech}h Tech / ${h.heuresAssistant}h Assistant`;
}

export function EquipementsListe({
  siteId,
  equipements,
  typesById,
  references,
  freqCouranteParEquipement,
  isAdmin,
}: {
  siteId: string;
  equipements: Equipement[];
  typesById: Record<string, TypeEquipement>;
  references: ReferenceHoraire[];
  freqCouranteParEquipement: Map<string, number | null>;
  isAdmin: boolean;
}) {
  const [qrOuvert, setQrOuvert] = useState<Equipement | null>(null);

  if (equipements.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Aucun équipement enregistré pour ce client
      </p>
    );
  }

  const parGroupe = new Map<string, Equipement[]>();
  for (const eq of equipements) {
    const g = eq.groupe.trim() || "Sans groupe";
    const liste = parGroupe.get(g) ?? [];
    liste.push(eq);
    parGroupe.set(g, liste);
  }
  for (const liste of parGroupe.values()) liste.sort((a, b) => a.nom.localeCompare(b.nom));
  const groupesTries = [...parGroupe.keys()].sort((a, b) => {
    if (a === "Sans groupe") return 1;
    if (b === "Sans groupe") return -1;
    return a.localeCompare(b);
  });

  const heuresSite = sommeHeuresAnnee(equipements, references, freqCouranteParEquipement);

  return (
    <div className="space-y-3">
      {(heuresSite.prevues.heuresTech > 0 || heuresSite.prevues.heuresAssistant > 0) && (
        <CarteHeures titre="Heures prévues (ce site)" heures={heuresSite} />
      )}

      {groupesTries.map((groupe, i) => (
        <Groupe
          key={groupe}
          nom={groupe}
          couleur={COULEURS[i % COULEURS.length]}
          equipements={parGroupe.get(groupe)!}
          typesById={typesById}
          references={references}
          freqCouranteParEquipement={freqCouranteParEquipement}
          isAdmin={isAdmin}
          siteId={siteId}
          onQr={setQrOuvert}
          ouvertParDefaut={groupesTries.length === 1}
        />
      ))}

      {qrOuvert && (
        <QrDialog nom={qrOuvert.nom} codeQr={qrOuvert.code_qr} onClose={() => setQrOuvert(null)} />
      )}
    </div>
  );
}

function CarteHeures({ titre, heures, compact }: { titre: string; heures: HeuresAnnee; compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs font-semibold text-teal-700">
        {titre} : {fmt(heures.prevues)}
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-teal-50 p-4">
      <p className="text-sm font-bold text-teal-800">
        {titre} : {fmt(heures.prevues)}
      </p>
      <p className="mt-1 text-xs text-brand-green-dark">Effectuées : {fmt(heures.effectuees)}</p>
      <p className="text-xs text-orange-700">Restant à faire : {fmt(heures.restantes)}</p>
    </div>
  );
}

function Groupe({
  nom,
  couleur,
  equipements,
  typesById,
  references,
  freqCouranteParEquipement,
  isAdmin,
  siteId,
  onQr,
  ouvertParDefaut,
}: {
  nom: string;
  couleur: { bg: string; text: string };
  equipements: Equipement[];
  typesById: Record<string, TypeEquipement>;
  references: ReferenceHoraire[];
  freqCouranteParEquipement: Map<string, number | null>;
  isAdmin: boolean;
  siteId: string;
  onQr: (eq: Equipement) => void;
  ouvertParDefaut: boolean;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const heuresGroupe = sommeHeuresAnnee(equipements, references, freqCouranteParEquipement);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <button
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${couleur.bg}`}>
          <Cog className={`h-5 w-5 ${couleur.text}`} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{nom}</span>
          <span className="block text-xs text-slate-500">{equipements.length} équipement(s)</span>
          {(heuresGroupe.prevues.heuresTech > 0 || heuresGroupe.prevues.heuresAssistant > 0) && (
            <CarteHeures titre="Heures prévues" heures={heuresGroupe} compact />
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {ouvert && (
        <div className="space-y-2 px-4 pb-4">
          {equipements.map((eq) => (
            <CarteEquipement
              key={eq.id}
              eq={eq}
              type={typesById[eq.type_equipement_id]}
              references={references}
              freqCourante={freqCouranteParEquipement.get(eq.id) ?? null}
              isAdmin={isAdmin}
              siteId={siteId}
              onQr={onQr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CarteEquipement({
  eq,
  type,
  references,
  freqCourante,
  isAdmin,
  siteId,
  onQr,
}: {
  eq: Equipement;
  type: TypeEquipement | undefined;
  references: ReferenceHoraire[];
  freqCourante: number | null;
  isAdmin: boolean;
  siteId: string;
  onQr: (eq: Equipement) => void;
}) {
  const sousTitre = [type?.code ?? "Famille inconnue", eq.numero_equipement, eq.localisation]
    .filter((s) => s)
    .join(" — ");
  const typeConcat = concatTypeEquipement(eq.champs_en_tete);

  const freqBrut = eq.champs_en_tete.freqEntretienAnnuelle;
  const freqAnnuelle = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;
  const resultatReference = analyserReference(eq.champs_en_tete, references);

  return (
    <div
      className={`rounded-xl border p-3 ${
        eq.hors_contrat ? "border-orange-300 bg-orange-50/40" : "border-slate-200/80 bg-slate-50/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{eq.nom}</p>
            {eq.hors_contrat && (
              <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                Hors contrat
              </span>
            )}
          </div>
          {sousTitre && <p className="mt-0.5 text-xs text-slate-500">{sousTitre}</p>}
          {typeConcat && <p className="text-xs text-slate-400">{typeConcat}</p>}

          {resultatReference.horsCatalogue && (
            <p className="mt-1 text-[11px] font-semibold text-orange-700">
              Puissance &quot;{typeof eq.champs_en_tete.typeEquipement3 === "string" ? eq.champs_en_tete.typeEquipement3 : ""}
              &quot; hors catalogue — heures non calculées
            </p>
          )}

          {resultatReference.reference && Number.isFinite(freqAnnuelle) && freqCourante !== null && (
            <div className="mt-1.5">
              {(() => {
                const heures = calculerHeuresVisite(freqAnnuelle, freqCourante, resultatReference.reference);
                return heures ? (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                    <Clock className="h-3 w-3" strokeWidth={2} />
                    Prochaine visite : {fmt(heures)}
                  </p>
                ) : null;
              })()}
              <div className="mt-1">
                <VisiteChips freqAnnuelle={freqAnnuelle} freqCourante={freqCourante} />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => onQr(eq)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="QR code équipement"
        >
          <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {eq.remarque_technicien && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          {eq.remarque_technicien}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <Link
          href={`/gmao/clients/${siteId}/equipements/${eq.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Eye className="h-3.5 w-3.5" strokeWidth={2} />
          Visualiser
        </Link>
        {type && (
          <Link
            href={`/gmao/clients/${siteId}/equipements/${eq.id}/releve/nouveau`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-green/30 bg-green-50 px-2 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-green-100"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
            Démarrer entretien
          </Link>
        )}
      </div>

      {isAdmin && (
        <div className="mt-2">
          <BoutonSupprimer
            action={supprimerEquipement.bind(null, eq.id, siteId)}
            confirmation={`Supprimer l'équipement "${eq.nom}" ?`}
            redirectTo={`/gmao/clients/${siteId}/equipements`}
            label="Supprimer"
          />
        </div>
      )}
    </div>
  );
}
