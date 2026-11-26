"use client";

import { useEffect, useRef } from "react";
import { ecrireBrouillon } from "./stockage";

/// Garde la saisie en cours sur le téléphone : peu après chaque changement,
/// toutes les 10 s (les signatures ne déclenchent pas de changement), et
/// quand l'écran passe en arrière-plan ou que la page se ferme. `construire`
/// peut rendre `null` : rien à garder à cet instant.
export function useSauvegardeLocale(
  cle: string,
  libelle: string,
  actif: boolean,
  construire: () => unknown,
  deps: unknown[],
) {
  const construireRef = useRef(construire);
  useEffect(() => {
    construireRef.current = construire;
  });

  useEffect(() => {
    if (!actif) return;
    const t = window.setTimeout(() => {
      const donnees = construireRef.current();
      if (donnees !== null) ecrireBrouillon(cle, libelle, donnees);
    }, 800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relancé à chaque changement de la saisie
  }, [actif, cle, libelle, ...deps]);

  useEffect(() => {
    if (!actif) return;
    const sauver = () => {
      const donnees = construireRef.current();
      if (donnees !== null) ecrireBrouillon(cle, libelle, donnees);
    };
    const quandCache = () => {
      if (document.visibilityState === "hidden") sauver();
    };
    const minuteur = window.setInterval(sauver, 10000);
    window.addEventListener("pagehide", sauver);
    document.addEventListener("visibilitychange", quandCache);
    return () => {
      window.clearInterval(minuteur);
      window.removeEventListener("pagehide", sauver);
      document.removeEventListener("visibilitychange", quandCache);
    };
  }, [actif, cle, libelle]);
}
