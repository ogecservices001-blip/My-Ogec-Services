"use client";

import { useMemo, useState } from "react";
import { ChoixClientSite } from "./choix-client-site";

/// Filtre Client | Site au-dessus d'une liste, construit à partir des lignes
/// elles-mêmes : seuls les clients et sites présents sont proposés. Choisir un
/// client garde tous ses sites, choisir un site ne garde que lui.
export function useFiltreClientSite<T>(lignes: T[], cle: (l: T) => { client: string; site: string }, id = "filtre") {
  const [client, setClient] = useState("");
  const [siteId, setSiteId] = useState("");

  const sites = useMemo(() => {
    const m = new Map<string, { id: string; nom: string; site: string }>();
    for (const l of lignes) {
      const { client: c, site: s } = cle(l);
      if (!c) continue;
      const k = `${c}|${s}`;
      if (!m.has(k)) m.set(k, { id: k, nom: c, site: s || "(sans site)" });
    }
    return [...m.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes]);

  const filtrees = useMemo(() => {
    if (!client && !siteId) return lignes;
    return lignes.filter((l) => {
      const { client: c, site: s } = cle(l);
      return siteId ? `${c}|${s}` === siteId : c === client;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, client, siteId]);

  const bloc = (
    <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
      <ChoixClientSite
        sites={sites}
        clientNom={client}
        siteId={siteId}
        idClient={`${id}-client`}
        idSite={`${id}-site`}
        obligatoire={false}
        onChange={(choix) => {
          setClient(choix.clientNom);
          setSiteId(choix.siteId);
        }}
      />
    </div>
  );

  return { filtrees, bloc, actif: Boolean(client || siteId) };
}
