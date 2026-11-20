"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanText, X } from "lucide-react";
import { useChampManquant } from "@/components/champ-manquant";
import { analyserContactCapture } from "@/app/(app)/repertoire/clients/contact-actions";
import { contactVide, type ContactSite } from "@/lib/repertoire/emplacements-contact";
import type { ActionResult } from "@/lib/action-result";

/// Emplacement proposé dans « C'est quel contact ? » : `actuel` null = ajout
/// d'un nouveau contact (rien à remplacer).
export type ChoixEmplacementContact = { valeur: string; libelle: string; actuel: ContactSite | null };

type Props = {
  choix: ChoixEmplacementContact[];
  parDefaut: string;
  enregistrer: (emplacement: string, contact: ContactSite) => Promise<ActionResult>;
};

const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";
const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";
const VIDE: ContactSite = { nom: "", fixe: "", portable: "", courriel: "" };

export function BoutonContactCapture(props: Props) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <ScanText className="h-4 w-4" strokeWidth={2} />
        Ajouter un contact depuis une capture
      </button>
      {ouvert && <FenetreContact {...props} onFermer={() => setOuvert(false)} />}
    </>
  );
}

function FenetreContact({ choix, parDefaut, enregistrer: enregistrerContact, onFermer }: Props & { onFermer: () => void }) {
  const router = useRouter();
  const { signaler, fenetre } = useChampManquant();
  const [lecture, startLecture] = useTransition();
  const [enregistrement, startEnregistrement] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactSite | null>(null);
  const [emplacement, setEmplacement] = useState(parDefaut);
  const [confirmerRemplacement, setConfirmerRemplacement] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const actuel = choix.find((c) => c.valeur === emplacement)?.actuel ?? null;
  const occupe = actuel !== null && !contactVide(actuel);

  function lire(fichier: File) {
    setErreur(null);
    setApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return fichier.type.startsWith("image/") ? URL.createObjectURL(fichier) : null;
    });
    const formData = new FormData();
    formData.set("fichier", fichier);
    startLecture(async () => {
      const res = await analyserContactCapture(formData);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      setContact({ ...VIDE, ...res.resultat });
    });
  }

  useEffect(() => {
    function surCollage(e: ClipboardEvent) {
      const fichier = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (!fichier) return;
      e.preventDefault();
      lire(fichier);
    }
    window.addEventListener("paste", surCollage);
    return () => window.removeEventListener("paste", surCollage);
  }, []);

  useEffect(() => () => {
    if (apercu) URL.revokeObjectURL(apercu);
  }, [apercu]);

  function enregistrer() {
    if (!contact) return;
    if (!contact.nom.trim() && !contact.courriel.trim()) {
      signaler("Renseigne au moins le nom ou le courriel", "contact-nom");
      return;
    }
    if (occupe && !confirmerRemplacement) {
      setConfirmerRemplacement(true);
      return;
    }
    startEnregistrement(async () => {
      const res = await enregistrerContact(emplacement, contact);
      if (!res.ok) {
        setErreur(res.erreur);
        setConfirmerRemplacement(false);
        return;
      }
      router.refresh();
      onFermer();
    });
  }

  const modifier = (cle: keyof ContactSite, valeur: string) => setContact((c) => (c ? { ...c, [cle]: valeur } : c));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      {fenetre}
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Ajouter un contact depuis une capture</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) de la capture collée
            <img src={apercu} alt="Capture collée" className="mx-auto mb-3 max-h-48 rounded-lg" />
          ) : null}
          <p className="text-sm text-slate-600">
            {lecture ? "Lecture de la capture…" : "Fais ta copie d'écran de la signature, puis colle-la ici avec Ctrl+V."}
          </p>
          <button
            type="button"
            onClick={() => fichierRef.current?.click()}
            disabled={lecture}
            className="mt-2 text-xs font-semibold text-brand-green hover:underline disabled:opacity-50"
          >
            ou choisir une image / un PDF
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lire(f);
              e.target.value = "";
            }}
          />
        </div>

        {erreur && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

        {contact && (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-nom" className={ETIQUETTE}>Nom</label>
                <input id="contact-nom" value={contact.nom} onChange={(e) => modifier("nom", e.target.value)} className={CHAMP} />
              </div>
              <div>
                <label htmlFor="contact-courriel" className={ETIQUETTE}>Courriel</label>
                <input id="contact-courriel" value={contact.courriel} onChange={(e) => modifier("courriel", e.target.value)} className={CHAMP} />
              </div>
              <div>
                <label htmlFor="contact-fixe" className={ETIQUETTE}>Tel fixe</label>
                <input id="contact-fixe" value={contact.fixe} onChange={(e) => modifier("fixe", e.target.value)} className={CHAMP} />
              </div>
              <div>
                <label htmlFor="contact-portable" className={ETIQUETTE}>Portable</label>
                <input id="contact-portable" value={contact.portable} onChange={(e) => modifier("portable", e.target.value)} className={CHAMP} />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="contact-emplacement" className={ETIQUETTE}>C&apos;est quel contact ?</label>
              <select
                id="contact-emplacement"
                value={emplacement}
                onChange={(e) => {
                  setEmplacement(e.target.value);
                  setConfirmerRemplacement(false);
                }}
                className={`${CHAMP} bg-white`}
              >
                {choix.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {c.actuel === null ? c.libelle : `${c.libelle} — ${contactVide(c.actuel) ? "libre" : c.actuel.nom || c.actuel.courriel}`}
                  </option>
                ))}
              </select>
            </div>

            {occupe && (
              <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${confirmerRemplacement ? "bg-orange-50 text-orange-800" : "bg-slate-50 text-slate-600"}`}>
                <p className="font-semibold">Cet emplacement est déjà pris :</p>
                <p>{[actuel?.nom, actuel?.fixe, actuel?.portable, actuel?.courriel].filter(Boolean).join(" · ")}</p>
                {confirmerRemplacement && <p className="mt-1 font-semibold">Remplacer par le nouveau contact ?</p>}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {confirmerRemplacement && (
                <button
                  type="button"
                  onClick={() => setConfirmerRemplacement(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Non
                </button>
              )}
              <button
                type="button"
                onClick={enregistrer}
                disabled={enregistrement || lecture}
                className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark disabled:opacity-60"
              >
                {enregistrement ? "Enregistrement…" : confirmerRemplacement ? "Oui, remplacer" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
