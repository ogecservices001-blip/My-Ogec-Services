"use client";

import Link from "next/link";
import { Download, Upload } from "lucide-react";

/// En-tête commun aux deux écrans Devis : titre + export/import. Le
/// reste (onglets de filtre) est propre à chaque écran, affiché par
/// l'appelant juste en dessous — Chrono Devis n'a pas de filtre
/// sous/hors contrat (il montre TOUS les devis), contrairement à Par
/// client.
export function DevisEntete({ isAdmin }: { isAdmin: boolean }) {
  return (
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
  );
}

/// Bouton Chrono Devis / Par client — toujours en premier (tout à
/// gauche) sur les deux écrans.
export function DevisVueToggle({ vueActive }: { vueActive: "registre" | "client" }) {
  return (
    <>
      <Link
        href="/devis"
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
          vueActive === "registre" ? "bg-sky-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        }`}
      >
        Chrono Devis
      </Link>
      <Link
        href="/devis/par-client"
        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
          vueActive === "client" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
        }`}
      >
        Par client
      </Link>
    </>
  );
}
