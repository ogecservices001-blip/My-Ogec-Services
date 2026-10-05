"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Phone, ChevronDown, Upload, Download, Pencil, KeyRound } from "lucide-react";
import type { Profil } from "@/lib/types";
import { initiales } from "@/lib/format";
import { recupererMotDePasse } from "./mdp-actions";

export function CollaborateursListe({
  profils,
  isAdmin,
}: {
  profils: Profil[];
  isAdmin: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
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
    () =>
      profils.filter((p) =>
        p.name.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [profils, recherche],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/repertoire"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Retour
        </Link>
        {isAdmin && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Annuaire collaborateurs
      </h1>
      <p className="mb-5 text-sm text-slate-500">{filtres.length} collaborateur(s)</p>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Rechercher un collègue..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
        />
      </div>

      {filtres.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun collaborateur trouvé</p>
      ) : (
        <ul className="space-y-3">
          {filtres.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <button
                onClick={() => setOuvert(ouvert === p.id ? null : p.id)}
                className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                  {initiales(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                  {p.name}
                </span>
                {p.portable && (
                  <a
                    href={`tel:${p.portable}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-brand-green-dark transition hover:bg-brand-green/10"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                    {p.portable}
                  </a>
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-300 transition ${
                    ouvert === p.id ? "rotate-180" : ""
                  }`}
                />
              </button>
              {ouvert === p.id && (
                <div className="space-y-1.5 border-t border-slate-50 bg-slate-50/50 px-4 py-3 pl-[68px] text-sm text-slate-600">
                  {p.qualite && <p>Qualité : {p.qualite}</p>}
                  {p.email_pro && <p>Email pro : {p.email_pro}</p>}
                  {p.email_perso && <p>Email personnel : {p.email_perso}</p>}
                  {p.commune_habitation && (
                    <p>Commune : {p.commune_habitation}</p>
                  )}
                  {p.vehicule && <p>Véhicule : {p.vehicule}</p>}
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <Link
                        href={`/repertoire/collaborateurs/${p.id}/modifier`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                        Modifier
                      </Link>
                      {mdpVisibles[p.id] === undefined ? (
                        <button
                          onClick={() => voirMotDePasse(p.id)}
                          disabled={chargementMdp}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
                        >
                          <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                          Voir le mot de passe
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                          {mdpVisibles[p.id]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
