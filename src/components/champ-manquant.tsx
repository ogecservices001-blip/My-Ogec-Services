"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/// Champ à désigner : son id, une ref React, ou l'élément lui-même.
export type CibleChamp = string | HTMLElement | { current: HTMLElement | null } | null;

type Alerte = { titre: string; detail?: string; cible: CibleChamp; lien?: { href: string; texte: string } };

const DUREE_EVIDENCE_MS = 2500;

function elementDe(cible: CibleChamp): HTMLElement | null {
  if (!cible) return null;
  if (typeof cible === "string") return document.getElementById(cible);
  if (cible instanceof HTMLElement) return cible;
  return cible.current;
}

/// Va sur le champ : défilement, mise en évidence quelques secondes, curseur dedans.
const FOCUSABLES = "input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex]";

export function pointerVersChamp(cible: CibleChamp) {
  const el = elementDe(cible);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Un bloc (groupe de cases, zone de saisie) : le curseur va dans son premier champ.
  let aFocaliser = el.matches(FOCUSABLES) ? el : el.querySelector<HTMLElement>(FOCUSABLES);
  if (!aFocaliser) {
    el.setAttribute("tabindex", "-1");
    aFocaliser = el;
  }
  aFocaliser.focus({ preventScroll: true });
  el.classList.add("champ-manquant");
  setTimeout(() => el.classList.remove("champ-manquant"), DUREE_EVIDENCE_MS);
}

/// Règle commune à toute l'appli quand une action est refusée : une fenêtre
/// dit ce qui manque, puis OK amène sur le champ concerné.
export function useChampManquant() {
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  const invalideEnCours = useRef(false);

  function signaler(titre: string, cible: CibleChamp = null, options?: { detail?: string; lien?: Alerte["lien"] }) {
    setAlerte({ titre, cible, ...options });
  }

  /// À poser sur un <form> (onInvalidCapture) : les champs `required` ou typés
  /// (email, date...) passent par la même fenêtre que le reste de l'appli au
  /// lieu de la bulle du navigateur. Seul le premier champ invalide est signalé.
  function surChampInvalide(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (invalideEnCours.current) return;
    invalideEnCours.current = true;
    setTimeout(() => (invalideEnCours.current = false), 0);
    const champ = e.target as HTMLInputElement;
    if (champ.type === "file" && champ.validity.valueMissing) {
      signaler("Choisis le fichier à importer", champ);
      return;
    }
    const libelle = libelleDuChamp(champ);
    signaler(
      champ.validity.valueMissing ? `Renseigne « ${libelle} »` : `« ${libelle} » n'est pas valide`,
      champ,
      champ.validity.valueMissing ? undefined : { detail: champ.validationMessage },
    );
  }

  function fermer() {
    const cible = alerte?.cible ?? null;
    setAlerte(null);
    setTimeout(() => pointerVersChamp(cible), 0);
  }

  const fenetre = alerte ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={fermer}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-slate-900">{alerte.titre}</h2>
        {alerte.detail && <p className="mt-2 text-sm text-slate-600">{alerte.detail}</p>}
        <div className="mt-4 flex items-center justify-end gap-2">
          {alerte.lien && (
            <Link
              href={alerte.lien.href}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {alerte.lien.texte}
            </Link>
          )}
          <button
            type="button"
            autoFocus
            onClick={fermer}
            className="rounded-xl bg-brand-green px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { signaler, surChampInvalide, fenetre };
}

function libelleDuChamp(champ: HTMLInputElement): string {
  const brut =
    champ.labels?.[0]?.textContent ||
    champ.closest("div")?.querySelector("label")?.textContent ||
    champ.getAttribute("aria-label") ||
    champ.placeholder ||
    champ.name ||
    "ce champ";
  return brut.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

type ResultatServeur = { ok: true } | { ok: false; erreur: string; champs?: Record<string, string> } | null | undefined;

/// Formulaires validés côté serveur (useActionState) : à chaque refus, la
/// fenêtre signale le premier champ en erreur dans l'ordre de l'écran (clé
/// d'erreur = id du champ), sinon le message général.
export function useSignalerRefusServeur(
  resultat: ResultatServeur,
  signaler: ReturnType<typeof useChampManquant>["signaler"],
) {
  useEffect(() => {
    if (!resultat || resultat.ok) return;
    const enErreur = Object.entries(resultat.champs ?? {})
      .filter(([, message]) => message)
      .map(([cle, message]) => ({ message, el: document.getElementById(cle) }))
      .filter((e): e is { message: string; el: HTMLElement } => e.el !== null)
      .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (enErreur.length > 0) signaler(enErreur[0].message, enErreur[0].el);
    else signaler(resultat.erreur);
    // Seul un nouveau résultat doit déclencher la fenêtre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultat]);
}
