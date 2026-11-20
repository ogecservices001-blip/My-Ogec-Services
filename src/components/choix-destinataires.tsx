"use client";

import { useEffect, useState } from "react";
import { chargerContactsSite } from "@/app/(app)/repertoire/clients/contact-actions";
import { emailValide, type ContactCourriel } from "@/lib/repertoire/contacts-courriel";

/// Contacts à cocher avant l'envoi d'un mail (ceux du site, chargés, ou
/// `contactsConnus` fournis directement, ex. interlocuteurs d'un fournisseur),
/// plus des adresses ajoutées à la main. `parDefaut` : adresses cochées à l'ouverture.
export function useDestinataires(siteId: string | null | undefined, parDefaut: string[], contactsConnus?: ContactCourriel[]) {
  const [contacts, setContacts] = useState<ContactCourriel[] | null>(contactsConnus ?? (siteId ? null : []));
  const [coches, setCoches] = useState<string[]>(() => parDefaut.filter(Boolean));

  useEffect(() => {
    if (!siteId || contactsConnus) return;
    let annule = false;
    chargerContactsSite(siteId).then((c) => {
      if (!annule) setContacts(c);
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contactsConnus est fixé à l'ouverture de la fenêtre
  }, [siteId]);

  const [autre, setAutre] = useState("");
  /// Adresses à envoyer : les cochées, plus celle tapée sans avoir cliqué « Ajouter ».
  const destinataires = () => (autre.trim() ? [...coches, autre.trim()] : coches);
  return { contacts, coches, setCoches, autre, setAutre, destinataires };
}

type EtatDestinataires = ReturnType<typeof useDestinataires>;

export function ChoixDestinataires({
  etat,
  idChamp = "destinataire-autre",
}: {
  etat: EtatDestinataires;
  idChamp?: string;
}) {
  const { contacts, coches, setCoches: onChange, autre, setAutre } = etat;
  const [erreur, setErreur] = useState<string | null>(null);

  const estCoche = (email: string) => coches.some((c) => c.toLowerCase() === email.toLowerCase());
  const basculer = (email: string) =>
    onChange(estCoche(email) ? coches.filter((c) => c.toLowerCase() !== email.toLowerCase()) : [...coches, email]);
  const connus = new Set((contacts ?? []).map((c) => c.email.toLowerCase()));
  const ajoutees = coches.filter((c) => !connus.has(c.toLowerCase()));

  function ajouter() {
    const email = autre.trim();
    if (!email) return;
    if (!emailValide(email)) {
      setErreur("Adresse email invalide.");
      return;
    }
    setErreur(null);
    if (!estCoche(email)) onChange([...coches, email]);
    setAutre("");
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">Destinataires</p>
      {contacts === null ? (
        <p className="py-1 text-sm text-slate-400">Chargement des contacts…</p>
      ) : (
        <div className="space-y-0.5">
          {contacts.map((c) => (
            <label key={c.email} className="flex items-start gap-2 py-0.5 text-sm text-slate-700">
              <input type="checkbox" checked={estCoche(c.email)} onChange={() => basculer(c.email)} className="mt-0.5 h-4 w-4 accent-brand-green" />
              <span>
                <span className="font-medium">{c.nom || c.email}</span> <span className="text-xs text-slate-400">({c.role})</span>
                {c.nom && <span className="block text-xs text-slate-500">{c.email}</span>}
              </span>
            </label>
          ))}
          {ajoutees.map((email) => (
            <label key={email} className="flex items-center gap-2 py-0.5 text-sm text-slate-700">
              <input type="checkbox" checked onChange={() => basculer(email)} className="h-4 w-4 accent-brand-green" />
              {email}
            </label>
          ))}
          {contacts.length === 0 && ajoutees.length === 0 && (
            <p className="py-1 text-xs text-slate-400">Aucun courriel connu — ajoute une adresse ci-dessous.</p>
          )}
        </div>
      )}
      <div className="mt-1.5 flex gap-2">
        <input
          id={idChamp}
          type="email"
          value={autre}
          onChange={(e) => setAutre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Autre adresse"
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
        <button
          type="button"
          onClick={ajouter}
          className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Ajouter
        </button>
      </div>
      {erreur && <p className="mt-1 text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
