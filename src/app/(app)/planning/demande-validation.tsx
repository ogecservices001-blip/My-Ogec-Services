"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { useChampManquant } from "@/components/champ-manquant";
import { envoyerDemandeValidation, preparerDemandeValidation, type ContactClient, type PreparationDemande } from "./validation-actions";
import { LIBELLE_VALIDATION, type StatutValidation } from "@/lib/planning/validation";

const CHAMP =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";

/// Demande d'accord du client sur une intervention (tous ses jours) : mail
/// personnalisé avec lien de validation à l'interlocuteur sur site, copies
/// d'information (sans lien) aux autres contacts choisis.
export function DemandeValidation({ creneauId }: { creneauId: string }) {
  const router = useRouter();
  const { signaler, fenetre } = useChampManquant();
  const [prep, setPrep] = useState<PreparationDemande | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [copies, setCopies] = useState<string[]>([]);
  const [autreCopie, setAutreCopie] = useState("");
  const [message, setMessage] = useState("");
  const messageModifie = useRef(false);
  const [envoi, startEnvoi] = useTransition();
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    preparerDemandeValidation(creneauId).then((p) => {
      if (annule) return;
      setPrep(p);
      if (p) {
        setEmail(p.destinataire?.email ?? "");
        setNom(p.destinataire?.nom ?? "");
        setMessage(p.message);
      }
    });
    return () => {
      annule = true;
    };
  }, [creneauId]);

  function choisirDestinataire(c: ContactClient) {
    setEmail(c.email);
    setNom(c.nom);
    setCopies((cs) => cs.filter((x) => x !== c.email));
    if (!messageModifie.current && prep) {
      setMessage(prep.message.replace(/^Bonjour[^\n]*,/, c.nom ? `Bonjour ${c.nom},` : "Bonjour,"));
    }
  }

  function envoyer() {
    setErreur(null);
    if (!email.trim()) return signaler("Renseigne l'email de l'interlocuteur sur site", "validation-email");
    if (!message.trim()) return signaler("Le texte du mail est vide", "validation-message");
    startEnvoi(async () => {
      const res = await envoyerDemandeValidation({
        creneauId,
        destinataireEmail: email,
        destinataireNom: nom,
        copies: [...copies, ...autreCopie.split(/[;,\s]+/)].filter(Boolean),
        message,
      });
      if (!res.ok) return setErreur(res.erreur);
      setEnvoye(true);
      router.refresh();
    });
  }

  if (prep === undefined) return <p className="text-sm text-slate-400">Préparation du mail…</p>;
  if (prep === null) return <p className="text-sm text-slate-500">Pas de demande possible : ce créneau n&apos;est pas lié à un site client.</p>;
  if (envoye) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
        <CheckCircle2 className="h-4 w-4" />
        Demande envoyée à {email}. L&apos;intervention est en « Attente validation client ».
      </p>
    );
  }

  const autresContacts = prep.contacts.filter((c) => c.email !== email);
  return (
    <div className="space-y-3">
      {fenetre}
      {prep.demandeEnCours && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Déjà une demande : {LIBELLE_VALIDATION[prep.demandeEnCours.statut as StatutValidation] ?? prep.demandeEnCours.statut}, envoyée à{" "}
          {prep.demandeEnCours.destinataire} le {new Date(prep.demandeEnCours.envoyeLe).toLocaleDateString("fr-FR")}. Une nouvelle demande la remplace.
        </p>
      )}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Destinataire (reçoit le lien pour valider)</p>
        {prep.contacts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {prep.contacts.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => choisirDestinataire(c)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  c.email === email ? "bg-brand-green text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c.role}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex : M. Dupont)" className={CHAMP} />
          <input id="validation-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={CHAMP} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">En copie (pour information, sans le lien)</p>
        {autresContacts.map((c) => (
          <label key={c.role} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={copies.includes(c.email)}
              onChange={() => setCopies((cs) => (cs.includes(c.email) ? cs.filter((x) => x !== c.email) : [...cs, c.email]))}
              className="h-4 w-4 accent-brand-green"
            />
            {c.role} — {c.nom || c.email} <span className="text-xs text-slate-400">{c.email}</span>
          </label>
        ))}
        <input value={autreCopie} onChange={(e) => setAutreCopie(e.target.value)} placeholder="Autre email en copie (facultatif)" className={`${CHAMP} mt-1`} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Texte du mail (les dates et le bouton sont ajoutés en dessous)</p>
        <textarea
          id="validation-message"
          value={message}
          onChange={(e) => {
            messageModifie.current = true;
            setMessage(e.target.value);
          }}
          rows={8}
          className={CHAMP}
        />
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <button
        type="button"
        onClick={envoyer}
        disabled={envoi}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60"
      >
        <Mail className="h-4 w-4" strokeWidth={2.25} />
        {envoi ? "Envoi..." : "Envoyer la demande au client"}
      </button>
    </div>
  );
}
