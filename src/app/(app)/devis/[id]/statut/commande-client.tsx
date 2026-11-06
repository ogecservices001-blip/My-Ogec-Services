"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, ScanText, Trash2 } from "lucide-react";
import type { FichierCommandeClient } from "@/lib/devis/commande-client";
import {
  ajouterFichiersCommandeClient,
  appliquerLectureCommande,
  lireCommandeFichier,
  lireCommandeStockee,
  supprimerFichierCommandeClient,
  urlFichierCommandeClient,
  type LectureCommande,
} from "../../commande-client-actions";

const ACCEPTE = "application/pdf,image/jpeg,image/png";

function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const LIBELLE_TYPE: Record<string, string> = {
  bon_de_commande: "Bon de commande du client",
  devis_signe: "Devis signé par le client",
  autre: "Document non reconnu comme une commande",
};

export function ecartCommande(montantCommande: number | null, montantDevis: number | null): number | null {
  if (montantCommande === null || montantDevis === null) return null;
  const ecart = Math.round((montantCommande - montantDevis) * 100) / 100;
  return Math.abs(ecart) >= 0.01 ? ecart : null;
}

/// Ce que la lecture a trouvé, et les champs de la fiche client à compléter,
/// chacun cochable. Rien n'est enregistré ici.
export function PanneauLecture({
  lecture,
  retenus,
  onBasculer,
}: {
  lecture: LectureCommande;
  retenus: Set<string>;
  onBasculer: (cle: string) => void;
}) {
  const { extraction } = lecture;
  const ecart = ecartCommande(extraction.montant_ht, lecture.montantDevis);
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm">
      <p className="font-semibold text-violet-800">{LIBELLE_TYPE[extraction.type_document]}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-slate-700">
        <dt className="text-slate-500">N° de commande</dt>
        <dd>{lecture.reference || "—"}</dd>
        <dt className="text-slate-500">Date</dt>
        <dd>{extraction.date_commande || "—"}</dd>
        {extraction.signataire && (
          <>
            <dt className="text-slate-500">Signataire</dt>
            <dd>{extraction.signataire}</dd>
          </>
        )}
        <dt className="text-slate-500">Montant HT</dt>
        <dd>
          {extraction.montant_ht !== null ? eur(extraction.montant_ht) : "—"}
          {lecture.montantDevis !== null && ` (devis : ${eur(lecture.montantDevis)})`}
        </dd>
      </dl>
      {ecart !== null && (
        <p className="rounded-lg bg-amber-100 px-2.5 py-1.5 font-semibold text-amber-800">
          Écart avec le devis : {ecart > 0 ? "+" : ""}
          {eur(ecart)}
        </p>
      )}
      {lecture.propositions.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">À ajouter sur la fiche du client (champs vides) :</p>
          {lecture.propositions.map((p) => (
            <label key={p.cle} className="flex items-start gap-2 py-0.5">
              <input type="checkbox" checked={retenus.has(p.cle)} onChange={() => onBasculer(p.cle)} className="mt-0.5 h-4 w-4 accent-violet-600" />
              <span>
                <span className="text-slate-500">{p.label} : </span>
                {p.valeur}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Rien de nouveau pour la fiche du client.</p>
      )}
    </div>
  );
}

export function champsRetenus(lecture: LectureCommande, retenus: Set<string>): Record<string, string> {
  return Object.fromEntries(lecture.propositions.filter((p) => retenus.has(p.cle)).map((p) => [p.cle, p.valeur]));
}

/// Choix des fichiers à "Marquer commandé" : le premier est lu aussitôt pour
/// pré-remplir la commande ; l'envoi se fait à la validation.
export function ChoixFichiersCommande({
  devisId,
  onChange,
  onLecture,
}: {
  devisId: string;
  onChange: (fichiers: File[]) => void;
  onLecture: (lecture: LectureCommande | null) => void;
}) {
  const [lecture, setLecture] = useState<LectureCommande | null>(null);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());
  const [lectureEnCours, startLecture] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(fichiers: File[]) {
    onChange(fichiers);
    setLecture(null);
    onLecture(null);
    setErreur(null);
    if (fichiers.length === 0) return;
    const formData = new FormData();
    formData.append("fichier", fichiers[0]);
    startLecture(async () => {
      const res = await lireCommandeFichier(devisId, formData);
      if (!res.ok || !res.lecture) {
        setErreur(res.ok ? "Lecture impossible." : res.erreur);
        return;
      }
      setLecture(res.lecture);
      const tous = new Set(res.lecture.propositions.map((p) => p.cle));
      setRetenus(tous);
      onLecture({ ...res.lecture, propositions: res.lecture.propositions.filter((p) => tous.has(p.cle)) });
    });
  }

  function basculer(cle: string) {
    if (!lecture) return;
    const suivant = new Set(retenus);
    if (suivant.has(cle)) suivant.delete(cle);
    else suivant.add(cle);
    setRetenus(suivant);
    onLecture({ ...lecture, propositions: lecture.propositions.filter((p) => suivant.has(p.cle)) });
  }

  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-medium text-slate-600">Commande du client (PDF, photo ou scan)</label>
      <input
        type="file"
        multiple
        accept={ACCEPTE}
        onChange={(e) => choisir(Array.from(e.target.files ?? []))}
        className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700"
      />
      {lectureEnCours && <p className="mt-2 text-xs text-violet-700">Lecture de la commande...</p>}
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
      {lecture && <PanneauLecture lecture={lecture} retenus={retenus} onBasculer={basculer} />}
    </div>
  );
}

export async function envoyerFichiersCommande(devisId: string, fichiers: File[]) {
  const formData = new FormData();
  for (const f of fichiers) formData.append("fichiers", f);
  return ajouterFichiersCommandeClient(devisId, formData);
}

export function BlocCommandeClient({
  devisId,
  fichiers,
  commandeEnregistree,
}: {
  devisId: string;
  fichiers: FichierCommandeClient[];
  commandeEnregistree: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureCommande | null>(null);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());
  const [majCommande, setMajCommande] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  function joindre(liste: File[]) {
    if (liste.length === 0) return;
    setErreur(null);
    startTransition(async () => {
      const res = await envoyerFichiersCommande(devisId, liste);
      if (champ.current) champ.current.value = "";
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  function ouvrir(chemin: string) {
    const onglet = window.open("", "_blank");
    urlFichierCommandeClient(chemin).then((url) => {
      if (url && onglet) onglet.location.href = url;
      else {
        onglet?.close();
        setErreur("Impossible d'ouvrir le fichier.");
      }
    });
  }

  function lire(chemin: string) {
    setErreur(null);
    setLecture(null);
    setEnregistre(false);
    startTransition(async () => {
      const res = await lireCommandeStockee(devisId, chemin);
      if (!res.ok || !res.lecture) {
        setErreur(res.ok ? "Lecture impossible." : res.erreur);
        return;
      }
      setLecture(res.lecture);
      setRetenus(new Set(res.lecture.propositions.map((p) => p.cle)));
      setMajCommande(!commandeEnregistree && Boolean(res.lecture.extraction.date_commande));
    });
  }

  function basculer(cle: string) {
    setRetenus((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  function enregistrerLecture() {
    if (!lecture) return;
    setErreur(null);
    startTransition(async () => {
      const res = await appliquerLectureCommande(devisId, {
        champs: champsRetenus(lecture, retenus),
        montantCommande: lecture.extraction.montant_ht,
        commande: majCommande ? { date: lecture.extraction.date_commande, reference: lecture.reference } : undefined,
      });
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setLecture(null);
      setEnregistre(true);
      router.refresh();
    });
  }

  function supprimer(chemin: string) {
    setErreur(null);
    startTransition(async () => {
      const res = await supprimerFichierCommandeClient(devisId, chemin);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold text-slate-900">Commande client</h2>
      {fichiers.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Aucun fichier joint.</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {fichiers.map((f) => (
            <li key={f.chemin} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <button type="button" onClick={() => ouvrir(f.chemin)} className="flex min-w-0 items-center gap-1.5 text-left font-medium text-slate-800 hover:underline">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                <span className="truncate">{f.nom}</span>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-slate-400">{f.ajoute_le}</span>
                <button type="button" onClick={() => lire(f.chemin)} disabled={pending} title="Lire la commande" className="text-violet-600 hover:text-violet-800 disabled:opacity-40">
                  <ScanText className="h-4 w-4" strokeWidth={2} />
                </button>
                <button type="button" onClick={() => supprimer(f.chemin)} disabled={pending} title="Supprimer" className="text-red-500 hover:text-red-700 disabled:opacity-40">
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && !lecture && <p className="mb-2 text-xs text-violet-700">Traitement en cours...</p>}

      {lecture && (
        <>
          <PanneauLecture lecture={lecture} retenus={retenus} onBasculer={basculer} />
          {!commandeEnregistree && lecture.extraction.date_commande && (
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={majCommande} onChange={(e) => setMajCommande(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
              Marquer le devis commandé le {lecture.extraction.date_commande}
              {lecture.reference ? `, réf. ${lecture.reference}` : ""}
            </label>
          )}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setLecture(null)} disabled={pending} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Ignorer
            </button>
            <button type="button" onClick={enregistrerLecture} disabled={pending} className="flex-1 rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60">
              {pending ? "Enregistrement..." : "Enregistrer la sélection"}
            </button>
          </div>
        </>
      )}
      {enregistre && <p className="mt-2 text-xs font-semibold text-brand-green-dark">Lecture enregistrée.</p>}

      <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
        <Paperclip className="h-4 w-4" strokeWidth={2} />
        {pending ? "Envoi..." : "Joindre la commande du client"}
        <input ref={champ} type="file" multiple accept={ACCEPTE} className="hidden" disabled={pending} onChange={(e) => joindre(Array.from(e.target.files ?? []))} />
      </label>
      <p className="mt-2 text-xs text-slate-400">PDF, JPG ou PNG. Le bouton de lecture propose la date, le n° de commande et les infos du client.</p>
      {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
