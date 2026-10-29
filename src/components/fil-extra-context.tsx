"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type MaillonFil = { nom: string; href?: string };

type FilExtraValue = { maillons: MaillonFil[]; setMaillons: (m: MaillonFil[] | null) => void };

const FilExtraContext = createContext<FilExtraValue | null>(null);

export function FilExtraProvider({ children }: { children: React.ReactNode }) {
  const [maillons, setMaillons] = useState<MaillonFil[]>([]);
  return (
    <FilExtraContext.Provider value={{ maillons, setMaillons: (m) => setMaillons(m ?? []) }}>
      {children}
    </FilExtraContext.Provider>
  );
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
/// chacun cliquable sauf le dernier (la page courante). Se retire
/// automatiquement en quittant la page ou en changeant de fiche.
export function FilAjouter({ maillons }: { maillons: MaillonFil[] }) {
  const { setMaillons } = useFilExtra();
  const cle = JSON.stringify(maillons);
  useEffect(() => {
    setMaillons(maillons);
    return () => setMaillons(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, setMaillons]);
  return null;
}

export function useFilExtraLecture(): MaillonFil[] {
  return useFilExtra().maillons;
}
