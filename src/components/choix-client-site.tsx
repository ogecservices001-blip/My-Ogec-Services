"use client";

import { useEffect, useMemo, useState } from "react";
import { ListeRecherche, type OptionRecherche } from "./liste-recherche";
import { chargerNumerosSites, type NumeroSite } from "./numeros-sites-action";

let numerosEnCache: Promise<NumeroSite[]> | null = null;
function numerosSites(): Promise<NumeroSite[]> {
  numerosEnCache ??= chargerNumerosSites().catch(() => {
    numerosEnCache = null;
    return [];
  });
  return numerosEnCache;
}

/// n_affaire (« 401-04 ») : facultatif, permet de chercher un client par son
/// n° (« 401 ») et un site par son n° d'affaire.
export type SiteChoisissable = { id: string; nom: string; site: string; n_affaire?: string };

const ETIQUETTE = "mb-1 block text-xs font-medium text-slate-600";

/// Client | Site côte à côte, chacun avec recherche. Choisir un client limite
/// les sites (et prend le site d'office s'il est seul) ; on peut aussi
/// commencer par le site, le client se remplit alors tout seul.
export function ChoixClientSite({
  sites: sitesRecus,
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
  /// Les listes qui ne connaissent que les noms (BI, devis, dépannages…) ne
  /// fournissent pas le n° d'affaire : il est retrouvé par l'id du site,
  /// sinon par le couple client + site.
  const [numeros, setNumeros] = useState<NumeroSite[] | null>(null);
  const manquants = sitesRecus.some((s) => !s.n_affaire);
  useEffect(() => {
    if (!manquants) return;
    let actif = true;
    numerosSites().then((n) => actif && setNumeros(n));
    return () => {
      actif = false;
    };
  }, [manquants]);
  const sites = useMemo(() => {
    if (!numeros) return sitesRecus;
    const parId = new Map(numeros.map((n) => [n.id, n.n_affaire]));
    const parNom = new Map(numeros.map((n) => [`${n.nom}|${n.site}`, n.n_affaire]));
    return sitesRecus.map((s) => (s.n_affaire ? s : { ...s, n_affaire: parId.get(s.id) ?? parNom.get(`${s.nom}|${s.site}`) ?? "" }));
  }, [sitesRecus, numeros]);

  const optionsClients: OptionRecherche[] = useMemo(() => {
    const comptes = new Map<string, { n: number; numeros: Set<string> }>();
    for (const s of sites) {
      const c = comptes.get(s.nom) ?? { n: 0, numeros: new Set<string>() };
      c.n += 1;
      const numero = (s.n_affaire ?? "").split("-")[0].trim();
      if (numero) c.numeros.add(numero);
      comptes.set(s.nom, c);
    }
    return [...comptes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([nom, { n, numeros }]) => {
        const detail = [[...numeros].sort().join(", "), n > 1 ? `${n} sites` : ""].filter(Boolean).join(" — ");
        return { valeur: nom, label: nom, detail: detail || undefined };
      });
  }, [sites]);

  const optionsSites: OptionRecherche[] = useMemo(
    () =>
      sites
        .filter((s) => !clientNom || s.nom === clientNom)
        .sort((a, b) => (a.site || "").localeCompare(b.site || "", "fr") || a.nom.localeCompare(b.nom, "fr"))
        .map((s) => ({
          valeur: s.id,
          label: s.site || "Site sans nom",
          detail: [s.n_affaire, clientNom ? "" : s.nom].filter(Boolean).join(" — ") || undefined,
        })),
    [sites, clientNom],
  );

  const optionsAffaires: OptionRecherche[] = useMemo(
    () =>
      sites
        .filter((s) => s.n_affaire)
        .sort((a, b) => (a.n_affaire ?? "").localeCompare(b.n_affaire ?? "", "fr", { numeric: true }))
        .map((s) => ({ valeur: s.id, label: s.n_affaire ?? "", detail: `${s.nom} — ${s.site || "Site sans nom"}` })),
    [sites],
  );

  function choisirClient(nom: string) {
    const sitesDuClient = sites.filter((s) => s.nom === nom);
    const garde = sitesDuClient.some((s) => s.id === siteId) ? siteId : "";
    const siteChoisi = sitesDuClient.length === 1 ? sitesDuClient[0].id : garde;
    onChange({ clientNom: nom, siteId: siteChoisi });
    // Client validé et plusieurs sites : la liste de ses sites s'ouvre d'elle-même.
    if (nom && !siteChoisi && sitesDuClient.length > 1) {
      setTimeout(() => document.getElementById(idSite)?.focus(), 0);
    }
  }

  function choisirSite(id: string) {
    const site = sites.find((s) => s.id === id);
    onChange({ clientNom: site ? site.nom : clientNom, siteId: id });
  }

  const etoile = obligatoire ? " *" : "";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_1fr]">
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
      <div>
        <label htmlFor={`${idSite}-affaire`} className={ETIQUETTE}>
          N° d&apos;affaire
        </label>
        <ListeRecherche
          id={`${idSite}-affaire`}
          options={optionsAffaires}
          valeur={optionsAffaires.some((o) => o.valeur === siteId) ? siteId : ""}
          onChange={choisirSite}
          placeholder="Ex. 401-04"
          disabled={disabled}
          vide="Aucun n° trouvé"
        />
      </div>
    </div>
  );
}
