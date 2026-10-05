"use client";

import Link from "next/link";
import { Download, Upload } from "lucide-react";

/// En-tête commun aux deux écrans Devis (Chrono Devis et Par client) :
/// titre, export/import, puis les deux dimensions de filtre — sous/hors
/// contrat (reste sur le même écran) et Chrono/Par client (change
/// d'écran, garde le filtre contrat en cours).
export function DevisEntete({
  horsContrat,
  isAdmin,
  vueActive,
}: {
  horsContrat: boolean;
  isAdmin: boolean;
  vueActive: "registre" | "client";
}) {
  const hc = horsContrat ? "?horsContrat=1" : "";

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Devis</h1>
          <p className="text-sm text-slate-500">Registre complet — devis en attente et commandés</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <a
              href="/devis/export"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Exporter tous les devis"
            >
              <Download className="h-4 w-4" strokeWidth={2.25} />
            </a>
            <Link
              href="/devis/importer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Importer des devis"
            >
              <Upload className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={vueActive === "registre" ? "/devis" : "/devis/par-client"}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            !horsContrat ? "bg-brand-green text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients sous contrat
        </Link>
        <Link
          href={`${vueActive === "registre" ? "/devis" : "/devis/par-client"}?horsContrat=1`}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            horsContrat ? "bg-orange-500 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Clients hors contrat
        </Link>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <Link
          href={`/devis${hc}`}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vueActive === "registre" ? "bg-sky-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Chrono Devis
        </Link>
        <Link
          href={`/devis/par-client${hc}`}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            vueActive === "client" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Par client
        </Link>
      </div>
    </>
  );
}
