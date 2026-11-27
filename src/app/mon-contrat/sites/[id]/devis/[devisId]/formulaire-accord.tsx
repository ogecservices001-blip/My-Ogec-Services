"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/bi/signature-pad";
import { accepterDevis } from "../../../../actions";

export function FormulaireAccord({ siteId, devisId, email, numero }: { siteId: string; devisId: string; email: string; numero: string }) {
  const router = useRouter();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [nom, setNom] = useState("");
  const [qualite, setQualite] = useState("");
  const [conditions, setConditions] = useState(false);
  const [signatureVide, setSignatureVide] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  async function valider() {
    setErreur(null);
    if (!nom.trim()) return setErreur("Indiquez votre nom.");
    if (signatureVide) return setErreur("Signez dans le cadre prévu.");
    if (!conditions) return setErreur("Cochez la case d'acceptation du devis et des conditions générales.");
    setEnvoi(true);
    try {
      const r = await accepterDevis(siteId, devisId, {
        nom,
        qualite,
        signature: signatureRef.current?.getDataUrl() ?? "",
        conditions,
      });
      if (!r.ok) return setErreur(r.erreur);
      setFait(true);
      router.refresh();
    } catch {
      setErreur("Enregistrement impossible pour le moment, merci de réessayer.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-[#eef6ec] p-5 text-sm text-[#2f5f27]">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <div>
          <p className="text-base font-semibold">Merci, votre accord est enregistré.</p>
          <p>Votre bon pour accord signé vous a été envoyé par email à {email}. Nous revenons vers vous pour planifier les travaux.</p>
        </div>
      </div>
    );
  }

  const champ = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#4f9a41] focus:ring-2 focus:ring-[#4f9a41]/20";

  return (
    <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-lg font-bold text-slate-900">Bon pour accord</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Nom et prénom *</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" className={champ} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Qualité (ex. gérant, responsable technique)</label>
          <input value={qualite} onChange={(e) => setQualite(e.target.value)} className={champ} />
        </div>
      </div>
      <SignaturePad ref={signatureRef} titre="Signature *" onChange={setSignatureVide} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={conditions} onChange={(e) => setConditions(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4f9a41]" />
        <span>
          Je donne mon accord pour le devis n° {numero}, aux conditions de ce devis et des conditions générales de vente qui y sont jointes.
        </span>
      </label>
      {erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      <button
        onClick={valider}
        disabled={envoi}
        className="w-full rounded-xl bg-[#4f9a41] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#3d7a32] disabled:opacity-60"
      >
        {envoi ? "Enregistrement..." : "Signer et donner mon accord"}
      </button>
      <p className="text-xs text-slate-400">Vous êtes connecté avec {email}. Votre accord sera daté et associé à cette adresse.</p>
    </div>
  );
}
