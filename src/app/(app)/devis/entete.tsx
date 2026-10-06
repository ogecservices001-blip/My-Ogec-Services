"use client";

import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";

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
            href="/devis/nouveau"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green-dark"
            title="Nouveau devis"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Nouveau devis
          </Link>
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
