import Link from "next/link";
import { Check, Wrench } from "lucide-react";
import type { SujetSuivi } from "@/lib/gmao/suivi-pieces";

const STYLE_ETAT: Record<SujetSuivi["etat"], string> = {
  en_cours: "border-orange-200 bg-orange-50/40",
  termine: "border-green-200 bg-green-50/40",
  annule: "border-slate-200 bg-slate-50 opacity-70",
};
const LIBELLE_ETAT: Record<SujetSuivi["etat"], string> = { en_cours: "En cours", termine: "Remplacé", annule: "Devis annulé" };
const EN_ATTENTE: Record<string, string> = {
  devis: "devis à établir",
  envoi: "envoi du devis au client",
  accord: "accord du client",
  commande: "commande de la pièce",
  remplacement: "remplacement",
};

/// Suivi des pièces et travaux d'un équipement, une frise d'étapes par sujet.
/// Montants et liens vers le devis, le BI ou la commande : bureau seulement.
export function SuiviPieces({ sujets, isAdmin }: { sujets: SujetSuivi[]; isAdmin: boolean }) {
  if (sujets.length === 0) return null;
  return (
    <div className="mb-5 border-t border-slate-100 pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <Wrench className="h-4 w-4 text-orange-600" strokeWidth={2.25} />
        Suivi des pièces et travaux
      </p>
      <div className="space-y-2">
        {sujets.map((s) => {
          const prochaine = s.etapes.find((e) => !e.fait);
          return (
            <div key={s.cle} className={`rounded-xl border px-3 py-2 ${STYLE_ETAT[s.etat]}`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold text-slate-900">{s.titre}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    s.etat === "en_cours" ? "bg-orange-100 text-orange-700" : s.etat === "termine" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {s.etat === "en_cours" && prochaine ? `En attente : ${EN_ATTENTE[prochaine.code] ?? prochaine.libelle.toLowerCase()}` : LIBELLE_ETAT[s.etat]}
                </span>
                {isAdmin && s.montantHT !== null && (
                  <span className="text-xs text-slate-500">{s.montantHT.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT</span>
                )}
              </div>
              <ol className="flex flex-wrap items-center gap-1 text-xs">
                {s.etapes.map((e, i) => {
                  const contenu = (
                    <>
                      {e.fait ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} /> : <span className="h-2 w-2 shrink-0 rounded-full border border-current" />}
                      <span className="font-semibold">{e.libelle}</span>
                      {(e.date || e.ref) && <span className="opacity-80">{[e.date, e.ref].filter(Boolean).join(" · ")}</span>}
                    </>
                  );
                  const classe = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    e.fait ? "bg-green-100 text-green-800" : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`;
                  return (
                    <li key={e.code} className="flex items-center gap-1">
                      {i > 0 && <span className="text-slate-300">→</span>}
                      {isAdmin && e.lienBureau ? (
                        <Link href={e.lienBureau} className={`${classe} hover:underline`}>
                          {contenu}
                        </Link>
                      ) : (
                        <span className={classe}>{contenu}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}
