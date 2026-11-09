"use client";

import { useMemo } from "react";
import { ListeRecherche, type OptionRecherche } from "./liste-recherche";

export type SiteChoisissable = { id: string; nom: string; site: string };

const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

/// Client | Site côte à côte, chacun avec recherche. Choisir un client limite
/// les sites (et prend le site d'office s'il est seul) ; on peut aussi
/// commencer par le site, le client se remplit alors tout seul.
export function ChoixClientSite({
  sites,
  clientNom,
  siteId,
  onChange,
  idClient = "choix-client",
  idSite = "choix-site",
  disabled,
  obligatoire = true,
}: {
  sites: SiteChoisissable[];
  clientNom: string;
  siteId: string;
  onChange: (choix: { clientNom: string; siteId: string }) => void;
  idClient?: string;
  idSite?: string;
  disabled?: boolean;
  obligatoire?: boolean;
}) {
  const optionsClients: OptionRecherche[] = useMemo(() => {
    const comptes = new Map<string, number>();
    for (const s of sites) comptes.set(s.nom, (comptes.get(s.nom) ?? 0) + 1);
    return [...comptes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([nom, n]) => ({ valeur: nom, label: nom, detail: n > 1 ? `${n} sites` : undefined }));
  }, [sites]);

  const optionsSites: OptionRecherche[] = useMemo(
    () =>
      sites
        .filter((s) => !clientNom || s.nom === clientNom)
        .sort((a, b) => (a.site || "").localeCompare(b.site || "", "fr") || a.nom.localeCompare(b.nom, "fr"))
        .map((s) => ({
          valeur: s.id,
          label: s.site || "Site sans nom",
          detail: clientNom ? undefined : s.nom,
        })),
    [sites, clientNom],
  );

  function choisirClient(nom: string) {
    const sitesDuClient = sites.filter((s) => s.nom === nom);
    const garde = sitesDuClient.some((s) => s.id === siteId) ? siteId : "";
    onChange({ clientNom: nom, siteId: sitesDuClient.length === 1 ? sitesDuClient[0].id : garde });
  }

  function choisirSite(id: string) {
    const site = sites.find((s) => s.id === id);
    onChange({ clientNom: site ? site.nom : clientNom, siteId: id });
  }

  const etoile = obligatoire ? " *" : "";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={idClient} className={ETIQUETTE}>
          Client{etoile}
        </label>
        <ListeRecherche
          id={idClient}
          options={optionsClients}
          valeur={clientNom}
          onChange={choisirClient}
          placeholder="Tape pour chercher un client"
          disabled={disabled}
          vide="Aucun client trouvé"
        />
      </div>
      <div>
        <label htmlFor={idSite} className={ETIQUETTE}>
          Site{etoile}
        </label>
        <ListeRecherche
          id={idSite}
          options={optionsSites}
          valeur={siteId}
          onChange={choisirSite}
          placeholder={clientNom ? "Tape pour chercher un site" : "Site (ou commence par ici)"}
          disabled={disabled}
          vide="Aucun site trouvé"
        />
      </div>
    </div>
  );
}
