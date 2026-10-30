"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type MaillonFil = { nom: string; href?: string };

type FilExtraState = { maillons: MaillonFil[]; sousMenu: MaillonFil | null };
type FilExtraValue = FilExtraState & { definir: (etat: FilExtraState | null) => void };

const FilExtraContext = createContext<FilExtraValue | null>(null);

export function FilExtraProvider({ children }: { children: React.ReactNode }) {
  const [etat, setEtat] = useState<FilExtraState>({ maillons: [], sousMenu: null });
  // `definir` doit garder la même identité d'un rendu à l'autre : sinon
  // l'effet de FilAjouter (qui l'a en dépendance) se redéclenche à
  // chaque appel, qui recrée l'état, qui redéclenche l'effet... une
  // boucle de rendu continue plutôt qu'un simple "mise à jour une fois".
  const definir = useCallback((e: FilExtraState | null) => {
    setEtat(e ?? { maillons: [], sousMenu: null });
  }, []);
  const value = useMemo(() => ({ ...etat, definir }), [etat, definir]);
  return <FilExtraContext.Provider value={value}>{children}</FilExtraContext.Provider>;
}

function useFilExtra() {
  const ctx = useContext(FilExtraContext);
  if (!ctx) throw new Error("useFilExtra doit être utilisé dans FilExtraProvider");
  return ctx;
}

/// À placer sur une fiche de détail (site, fournisseur...) pour
/// ajouter un ou plusieurs derniers maillons au fil d'ariane — ex.
/// [{ nom: "A.N.P.A.A 974", href: "/repertoire/clients/groupe/..." },
/// { nom: "CSAPA EST" }] pour retrouver le client ET le site précis,
/// chacun cliquable sauf le dernier (la page courante). `sousMenu`
/// (optionnel) force le libellé/lien du niveau intermédiaire du fil
/// quand il ne peut pas se déduire de l'URL seule (ex. une fiche
/// dépannage accessible aussi bien depuis "Dépannages en cours" que
/// "Dépannages traités" — le bon parent dépend du statut réel, pas du
/// chemin). Se retire automatiquement en quittant la page ou en
/// changeant de fiche.
export function FilAjouter({ maillons, sousMenu }: { maillons: MaillonFil[]; sousMenu?: MaillonFil }) {
  const { definir } = useFilExtra();
  const cle = JSON.stringify({ maillons, sousMenu });
  useEffect(() => {
    definir({ maillons, sousMenu: sousMenu ?? null });
    return () => definir(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, definir]);
  return null;
}

export function useFilExtraLecture(): { maillons: MaillonFil[]; sousMenu: MaillonFil | null } {
  const { maillons, sousMenu } = useFilExtra();
  return { maillons, sousMenu };
}
