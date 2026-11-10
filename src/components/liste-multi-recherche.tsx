"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { normaliserRecherche, type OptionRecherche } from "./liste-recherche";

/// Liste déroulante avec recherche où l'on coche plusieurs valeurs ; les
/// valeurs choisies s'affichent au-dessus, chacune avec sa croix.
export function ListeMultiRecherche({
  id,
  options,
  valeurs,
  onChange,
  placeholder = "Tape pour chercher",
  vide = "Aucun résultat",
}: {
  id?: string;
  options: OptionRecherche[];
  valeurs: string[];
  onChange: (valeurs: string[]) => void;
  placeholder?: string;
  vide?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [actif, setActif] = useState(0);
  const conteneurRef = useRef<HTMLDivElement>(null);

  const filtrees = useMemo(() => {
    const cible = normaliserRecherche(saisie);
    return cible ? options.filter((o) => normaliserRecherche(`${o.label} ${o.detail ?? ""}`).includes(cible)) : options;
  }, [options, saisie]);

  useEffect(() => {
    if (!ouvert) return;
    function fermerSiDehors(e: MouseEvent) {
      if (!conteneurRef.current?.contains(e.target as Node)) {
        setOuvert(false);
        setSaisie("");
      }
    }
    document.addEventListener("mousedown", fermerSiDehors);
    return () => document.removeEventListener("mousedown", fermerSiDehors);
  }, [ouvert]);

  function basculer(valeur: string) {
    onChange(valeurs.includes(valeur) ? valeurs.filter((v) => v !== valeur) : [...valeurs, valeur]);
  }

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => Math.min(i + 1, filtrees.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtrees[actif]) basculer(filtrees[actif].valeur);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOuvert(false);
      setSaisie("");
    }
  }

  const choisies = valeurs.map((v) => options.find((o) => o.valeur === v)).filter((o): o is OptionRecherche => !!o);

  return (
    <div ref={conteneurRef} className="relative">
      {choisies.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {choisies.map((o) => (
            <span key={o.valeur} className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 py-1 pl-3 pr-1 text-xs font-semibold text-brand-green-dark">
              {o.label}
              <button
                type="button"
                aria-label={`Retirer ${o.label}`}
                onClick={() => basculer(o.valeur)}
                className="rounded-full p-0.5 hover:bg-brand-green/20"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={id ? `${id}-liste` : undefined}
        autoComplete="off"
        value={saisie}
        placeholder={choisies.length ? "Ajouter un autre…" : placeholder}
        onFocus={() => setOuvert(true)}
        onClick={() => setOuvert(true)}
        onChange={(e) => {
          setSaisie(e.target.value);
          setActif(0);
          setOuvert(true);
        }}
        onKeyDown={surTouche}
        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-base outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 sm:py-2 sm:text-sm"
      />
      <ChevronDown className={`pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-slate-400 transition sm:bottom-2.5 ${ouvert ? "rotate-180" : ""}`} />
      {ouvert && (
        <ul
          id={id ? `${id}-liste` : undefined}
          role="listbox"
          aria-multiselectable
          className="absolute z-40 mt-1 max-h-[50vh] w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:max-h-64"
        >
          {filtrees.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">{vide}</li>
          ) : (
            filtrees.map((o, i) => {
              const coche = valeurs.includes(o.valeur);
              return (
                <li
                  key={o.valeur}
                  role="option"
                  aria-selected={coche}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => basculer(o.valeur)}
                  onMouseEnter={() => setActif(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-3 text-base sm:py-2 sm:text-sm ${i === actif ? "bg-brand-green/10" : ""}`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      coche ? "border-brand-green bg-brand-green text-white" : "border-slate-300"
                    }`}
                  >
                    {coche && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className={coche ? "font-semibold text-brand-green-dark" : "text-slate-800"}>{o.label}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
