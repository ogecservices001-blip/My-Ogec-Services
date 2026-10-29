"use client";

import { createContext, useContext, useEffect, useState } from "react";

type FilExtraValue = { extra: string | null; setExtra: (nom: string | null) => void };

const FilExtraContext = createContext<FilExtraValue | null>(null);

export function FilExtraProvider({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = useState<string | null>(null);
  return <FilExtraContext.Provider value={{ extra, setExtra }}>{children}</FilExtraContext.Provider>;
}

function useFilExtra() {
  const ctx = useContext(FilExtraContext);
  if (!ctx) throw new Error("useFilExtra doit être utilisé dans FilExtraProvider");
  return ctx;
}

/// À placer sur une fiche de détail (site, fournisseur...) pour
/// ajouter un dernier maillon au fil d'ariane avec son nom — se
/// retire automatiquement en quittant la page ou en changeant de
/// fiche, pour que le fil reflète toujours où on se trouve vraiment.
export function FilAjouter({ nom }: { nom: string }) {
  const { setExtra } = useFilExtra();
  useEffect(() => {
    setExtra(nom);
    return () => setExtra(null);
  }, [nom, setExtra]);
  return null;
}

export function useFilExtraLecture(): string | null {
  return useFilExtra().extra;
}
