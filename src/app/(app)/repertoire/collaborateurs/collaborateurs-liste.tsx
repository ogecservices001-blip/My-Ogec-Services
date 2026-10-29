"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Search, Phone, Upload, Download, KeyRound } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import type { Profil } from "@/lib/types";
import { telInternational } from "@/lib/format";
import { recupererMotDePasse } from "./mdp-actions";

const COLONNES: ColonneTableur[] = [
  { titre: "Nom" },
  { titre: "Qualité" },
  { titre: "Portable" },
  { titre: "Email pro" },
  { titre: "Email personnel" },
  { titre: "Commune" },
  { titre: "Véhicule" },
];
const COLONNES_ADMIN: ColonneTableur[] = [...COLONNES, { titre: "" }];

export function CollaborateursListe({
  profils,
  isAdmin,
}: {
  profils: Profil[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [mdpVisibles, setMdpVisibles] = useState<Record<string, string>>({});
  const [chargementMdp, startChargementMdp] = useTransition();

  function voirMotDePasse(profilId: string) {
    startChargementMdp(async () => {
      const res = await recupererMotDePasse(profilId);
      setMdpVisibles((prev) => ({
        ...prev,
        [profilId]: res.ok ? res.mdp || "(non renseigné)" : `Erreur : ${res.erreur}`,
      }));
    });
  }

  const filtres = useMemo(
    () => profils.filter((p) => p.name.toLowerCase().includes(recherche.toLowerCase())),
    [profils, recherche],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Annuaire collaborateurs</h1>
          <p className="text-sm text-slate-500">{filtres.length} collaborateur(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Rechercher un collègue..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="w-56 rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          {isAdmin && (
            <>
              <a
                href="/repertoire/collaborateurs/export"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Exporter en Excel"
              >
                <Download className="h-4 w-4" strokeWidth={2.25} />
              </a>
              <Link
                href="/repertoire/collaborateurs/importer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                title="Importer un fichier"
              >
                <Upload className="h-4 w-4" strokeWidth={2.25} />
              </Link>
            </>
          )}
        </div>
      </div>

      <Tableur
        colonnes={isAdmin ? COLONNES_ADMIN : COLONNES}
        lignes={filtres.map((p) => {
          const base = [
            isAdmin ? (
              <Link key="nom" href={`/repertoire/collaborateurs/${p.id}/modifier`} className="font-bold text-slate-900 hover:underline">
                {p.name}
              </Link>
            ) : (
              p.name
            ),
            p.qualite,
            p.portable ? (
              <a
                key="tel"
                href={`tel:${telInternational(p.portable)}`}
                className="inline-flex items-center gap-1.5 text-brand-green-dark hover:underline"
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                {telInternational(p.portable)}
              </a>
            ) : (
              ""
            ),
            p.email_pro,
            p.email_perso,
            p.commune_habitation,
            p.vehicule,
          ];
          if (!isAdmin) return base;
          return [
            ...base,
            mdpVisibles[p.id] === undefined ? (
              <button
                key="mdp"
                type="button"
                onClick={() => voirMotDePasse(p.id)}
                disabled={chargementMdp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                Mot de passe
              </button>
            ) : (
              <span key="mdp" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                {mdpVisibles[p.id]}
              </span>
            ),
          ];
        })}
        valeurs={filtres.map((p) => [p.name, p.qualite, p.portable, p.email_pro, p.email_perso, p.commune_habitation, p.vehicule])}
        vide="Aucun collaborateur trouvé"
      />
    </div>
  );
}
