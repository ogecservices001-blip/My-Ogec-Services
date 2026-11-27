"use client";

import { useFiltreClientSite } from "@/components/filtre-client-site";
import { useMemo, useState } from "react";
import { isoDepuisFr, motifPrincipal, transformation } from "@/lib/devis/suivi-commercial";
import { DevisEntete } from "./entete";
import { TableauRegistreDevis, eur, type DevisRegistreLigne } from "./registre-liste";

export function ChronoDevis({
  registre,
  isAdmin,
}: {
  registre: DevisRegistreLigne[];
  isAdmin: boolean;
}) {
  const { filtrees: registreFiltre, bloc } = useFiltreClientSite(registre, (d) => ({ client: d.clientNom, site: d.clientSite }), "devis");
  const lignesTransformation = useMemo(
    () =>
      registre
        .filter((d) => d.numero && !d.annule)
        .map((d) => ({
          annee: (isoDepuisFr(d.dateDevis) || "").slice(0, 4),
          montant: d.montant,
          gagne: d.commande || d.realise || d.facturable,
          perdu: d.perdu,
          motifPerte: motifPrincipal(d.motifPerte),
        }))
        .filter((l) => l.annee),
    [registre],
  );
  const annees = useMemo(
    () => [...new Set([String(new Date().getFullYear()), ...lignesTransformation.map((l) => l.annee)])].sort().reverse(),
    [lignesTransformation],
  );
  const [annee, setAnnee] = useState(annees[0]);
  const stats = transformation(lignesTransformation, annee);

  return (
    <div>
      <DevisEntete isAdmin={isAdmin} />

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">Taux de transformation</p>
          <div className="flex flex-wrap gap-1">
            {annees.map((a) => (
              <button
                key={a}
                onClick={() => setAnnee(a)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${a === annee ? "bg-brand-green text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <Chiffre valeur={String(stats.envoyes)} libelle="Devis émis" />
          <Chiffre
            valeur={String(stats.gagnes)}
            suffixe={stats.tauxNombre !== null ? `${stats.tauxNombre} %` : undefined}
            libelle="Commandés"
            couleur="text-brand-green-dark"
          />
          <Chiffre valeur={String(stats.perdus)} libelle="Refusés / perdus" couleur="text-rose-600" />
          <Chiffre valeur={String(stats.enAttente)} libelle="En attente" couleur="text-amber-600" />
          {isAdmin && (
            <Chiffre
              valeur={eur(stats.montantGagne)}
              suffixe={stats.tauxMontant !== null ? `${stats.tauxMontant} %` : undefined}
              libelle={`Commandé sur ${eur(stats.montantEnvoye)} HT`}
              couleur="text-brand-green-dark"
            />
          )}
        </div>
        {stats.motifs.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Motifs de perte : {stats.motifs.map((m) => `${m.motif} (${m.nombre})`).join(" · ")}
          </p>
        )}
      </div>

      {registre.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun devis pour l&apos;instant</p>
      ) : (
        <>
          {bloc}
          <TableauRegistreDevis lignes={registreFiltre} isAdmin={isAdmin} />
        </>
      )}
    </div>
  );
}

function Chiffre({ valeur, suffixe, libelle, couleur = "text-slate-900" }: { valeur: string; suffixe?: string; libelle: string; couleur?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className={`text-lg font-bold ${couleur}`}>
        {valeur}
        {suffixe && <span className="text-sm font-semibold text-slate-400"> · {suffixe}</span>}
      </p>
      <p className="text-xs text-slate-500">{libelle}</p>
    </div>
  );
}
