"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type OptionRecherche = { valeur: string; label: string; detail?: string };

/// Sans accents ni majuscules : "Écoles" et "ecol" se retrouvent.
export function normaliserRecherche(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const CHAMP =
  "w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-14 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50";

/// Liste déroulante avec saisie : on tape quelques lettres, la liste se filtre,
/// on choisit à la souris, au doigt ou au clavier (flèches + Entrée, Échap).
export function ListeRecherche({
  id,
  options,
  valeur,
  onChange,
  placeholder = "— Choisir —",
  disabled,
  vide = "Aucun résultat",
}: {
  id?: string;
  options: OptionRecherche[];
  valeur: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  disabled?: boolean;
  vide?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [actif, setActif] = useState(0);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const choisie = options.find((o) => o.valeur === valeur);

  const filtrees = useMemo(() => {
    const cible = normaliserRecherche(saisie);
    if (!cible) return options;
    return options.filter((o) => normaliserRecherche(`${o.label} ${o.detail ?? ""}`).includes(cible));
  }, [options, saisie]);

  useEffect(() => {
    if (!ouvert) return;
    function fermerSiDehors(e: MouseEvent) {
      if (!conteneurRef.current?.contains(e.target as Node)) fermer();
    }
    document.addEventListener("mousedown", fermerSiDehors);
    return () => document.removeEventListener("mousedown", fermerSiDehors);
  }, [ouvert]);

  useEffect(() => {
    listeRef.current?.children[actif]?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  function ouvrir() {
    if (disabled) return;
    setOuvert(true);
    setSaisie("");
    setActif(Math.max(0, options.findIndex((o) => o.valeur === valeur)));
  }

  function fermer() {
    setOuvert(false);
    setSaisie("");
  }

  function choisir(option: OptionRecherche) {
    onChange(option.valeur);
    fermer();
  }

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ouvert && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      ouvrir();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => Math.min(i + 1, filtrees.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtrees[actif]) choisir(filtrees[actif]);
    } else if (e.key === "Escape") {
      fermer();
    } else if (e.key === "Tab") {
      fermer();
    }
  }

  return (
    <div ref={conteneurRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={id ? `${id}-liste` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={ouvert ? saisie : (choisie?.label ?? "")}
        placeholder={ouvert && choisie ? choisie.label : placeholder}
        onFocus={ouvrir}
        onClick={() => !ouvert && ouvrir()}
        onChange={(e) => {
          setSaisie(e.target.value);
          setActif(0);
          if (!ouvert) setOuvert(true);
        }}
        onKeyDown={surTouche}
        className={CHAMP}
      />
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
        {valeur && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Vider"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              fermer();
            }}
            className="pointer-events-auto rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${ouvert ? "rotate-180" : ""}`} />
      </div>
      {ouvert && (
        <ul
          ref={listeRef}
          id={id ? `${id}-liste` : undefined}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filtrees.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">{vide}</li>
          ) : (
            filtrees.map((o, i) => (
              <li
                key={o.valeur}
                role="option"
                aria-selected={o.valeur === valeur}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choisir(o)}
                onMouseEnter={() => setActif(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === actif ? "bg-brand-green/10" : ""
                } ${o.valeur === valeur ? "font-semibold text-brand-green-dark" : "text-slate-800"}`}
              >
                {o.label}
                {o.detail && <span className="ml-1.5 text-xs text-slate-400">{o.detail}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
