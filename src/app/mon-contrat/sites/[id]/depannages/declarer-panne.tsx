"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wrench } from "lucide-react";
import { declarerPanne } from "../../../actions";

export function DeclarerPanne({ siteId, equipements }: { siteId: string; equipements: { id: string; nom: string }[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [equipementId, setEquipementId] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ numero: string; accuseEnvoye: boolean } | null>(null);

  async function envoyer() {
    setErreur(null);
    if (!message.trim()) return setErreur("Merci de décrire la panne rencontrée.");
    setEnvoi(true);
    try {
      const r = await declarerPanne(siteId, equipementId || null, message);
      if (!r.ok) return setErreur(r.erreur);
      setResultat({ numero: r.numero, accuseEnvoye: r.accuseEnvoye });
      setMessage("");
      setEquipementId("");
      router.refresh();
    } catch {
      setErreur("L'envoi a échoué, merci de réessayer dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  const champ = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f9a41] focus:ring-2 focus:ring-[#4f9a41]/20";

  if (resultat) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-[#eef6ec] p-4 text-sm text-[#2f5f27]">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Votre demande de dépannage N°{resultat.numero} a bien été enregistrée.</p>
          <p>
            {resultat.accuseEnvoye ? "Un accusé de réception vient de vous être envoyé par email. " : ""}Nous revenons vers vous pour planifier
            l&apos;intervention.
          </p>
          <button onClick={() => setResultat(null)} className="mt-2 font-semibold underline">
            Déclarer une autre panne
          </button>
        </div>
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3.5 font-semibold text-white shadow-sm hover:bg-red-800">
        <Wrench className="h-5 w-5" /> Déclarer une panne
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-3 font-bold text-slate-900">Déclarer une panne</p>
      <label className="mb-1 block text-xs font-medium text-slate-600">Équipement concerné</label>
      <select value={equipementId} onChange={(e) => setEquipementId(e.target.value)} className={`${champ} bg-white`}>
        <option value="">Je ne sais pas / plusieurs équipements</option>
        {equipements.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nom}
          </option>
        ))}
      </select>
      <label className="mb-1 mt-3 block text-xs font-medium text-slate-600">Description de la panne</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Décrivez la panne rencontrée" className={champ} />
      {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => setOuvert(false)} disabled={envoi} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Annuler
        </button>
        <button onClick={envoyer} disabled={envoi} className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
          {envoi ? "Envoi..." : "Envoyer la demande"}
        </button>
      </div>
    </div>
  );
}
