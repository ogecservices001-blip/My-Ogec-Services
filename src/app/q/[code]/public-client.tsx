"use client";

import { useState } from "react";
import { QrCode, CheckCircle2, Wrench } from "lucide-react";
import type { EquipementPublicDonnees } from "@/lib/gmao/depannage";
import { verifierAccesEquipement, soumettreDemandeDepannage } from "./actions";

export function EquipementPublicClient({ codeQr }: { codeQr: string }) {
  const [email, setEmail] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [donnees, setDonnees] = useState<EquipementPublicDonnees | null>(null);
  const [emailValide, setEmailValide] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [demandeEnvoyee, setDemandeEnvoyee] = useState(false);

  async function verifier() {
    setErreur(null);
    if (!email.trim() || !email.includes("@")) {
      setErreur("Merci de saisir un email valide.");
      return;
    }
    setChargement(true);
    const res = await verifierAccesEquipement(codeQr, email.trim());
    setChargement(false);
    if (!res.ok) {
      setErreur(res.erreur);
      return;
    }
    setDonnees(res.donnees);
    setEmailValide(email.trim());
  }

  async function envoyerDemande() {
    setErreur(null);
    if (!message.trim()) {
      setErreur("Merci de décrire la panne rencontrée.");
      return;
    }
    if (!emailValide) return;
    setEnvoiEnCours(true);
    const res = await soumettreDemandeDepannage(codeQr, emailValide, message.trim());
    setEnvoiEnCours(false);
    if (!res.ok) {
      setErreur(res.erreur);
      return;
    }
    setDemandeEnvoyee(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-4 rounded-2xl bg-teal-700 px-5 py-4 text-center text-white shadow-sm">
          <p className="text-sm font-bold">Équipement OGEC Services</p>
        </div>

        {!donnees ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="text-center">
              <QrCode className="mx-auto mb-3 h-12 w-12 text-teal-600" strokeWidth={1.5} />
              <p className="mb-2 text-lg font-bold text-slate-900">Consulter cet équipement</p>
              <p className="mb-5 text-sm text-slate-600">
                Saisis l&apos;email connu d&apos;OGEC Services pour ce site afin d&apos;accéder aux
                informations de cet équipement.
              </p>
            </div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifier()}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
            <button
              onClick={verifier}
              disabled={chargement}
              className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
            >
              {chargement ? "Vérification..." : "Valider"}
            </button>
          </div>
        ) : (
          <ContenuEquipement
            donnees={donnees}
            erreur={erreur}
            message={message}
            setMessage={setMessage}
            envoiEnCours={envoiEnCours}
            demandeEnvoyee={demandeEnvoyee}
            onEnvoyer={envoyerDemande}
          />
        )}
      </div>
    </div>
  );
}

function ContenuEquipement({
  donnees,
  erreur,
  message,
  setMessage,
  envoiEnCours,
  demandeEnvoyee,
  onEnvoyer,
}: {
  donnees: EquipementPublicDonnees;
  erreur: string | null;
  message: string;
  setMessage: (v: string) => void;
  envoiEnCours: boolean;
  demandeEnvoyee: boolean;
  onEnvoyer: () => void;
}) {
  const { equipement, site, type } = donnees;
  const c = equipement.champs_en_tete;
  const champsSupp = type?.champs_en_tete_supplementaires ?? [];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-teal-50 p-4 shadow-sm">
        <p className="font-bold text-slate-900">{[site.nom, site.site].filter(Boolean).join(" — ")}</p>
        {(site.adresse || site.commune) && (
          <p className="text-xs text-slate-600">{[site.adresse, site.commune].filter(Boolean).join(", ")}</p>
        )}
        <p className="mt-2 text-lg font-bold text-slate-900">{equipement.nom}</p>
        {type && (
          <p className="text-sm text-slate-600">
            {type.code} — {type.nom}
          </p>
        )}
        {equipement.groupe && <p className="text-xs text-slate-500">Groupe : {equipement.groupe}</p>}
        {(equipement.numero_equipement || equipement.localisation) && (
          <p className="text-xs text-slate-500">
            {[equipement.numero_equipement, equipement.localisation].filter(Boolean).join(" — ")}
          </p>
        )}
      </div>

      {champsSupp.some((champ) => typeof c[champ.cle] === "string" && (c[champ.cle] as string).trim()) && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <dl>
            {champsSupp.map((champ) => {
              const v = c[champ.cle];
              if (typeof v !== "string" || !v.trim()) return null;
              return (
                <div key={champ.cle} className="flex items-baseline gap-2 py-1.5">
                  <dt className="w-1/2 shrink-0 text-xs text-slate-500">
                    {champ.unite ? `${champ.label} (${champ.unite})` : champ.label}
                  </dt>
                  <dd className="text-sm font-semibold text-slate-900">{v}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {equipement.remarque_technicien && (
        <div className="rounded-2xl bg-amber-50 p-4 shadow-sm">
          <p className="mb-1 text-xs font-bold text-amber-800">Notes de suivi</p>
          <p className="whitespace-pre-line text-xs text-amber-900">{equipement.remarque_technicien}</p>
        </div>
      )}

      {demandeEnvoyee ? (
        <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 shadow-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-green-dark" strokeWidth={2} />
          <p className="text-sm font-semibold text-brand-green-dark">
            Ta demande de dépannage a bien été transmise à OGEC Services.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-slate-900">Signaler une panne</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Décris la panne rencontrée"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
          <button
            onClick={onEnvoyer}
            disabled={envoiEnCours}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-60"
          >
            <Wrench className="h-4 w-4" strokeWidth={2} />
            {envoiEnCours ? "Envoi..." : "Demander un dépannage"}
          </button>
        </div>
      )}
    </div>
  );
}
