"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Fournisseur } from "@/lib/types";

export default function FournisseursListePage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("fournisseurs")
      .select("*")
      .order("nom")
      .then(({ data }) => {
        setFournisseurs((data as Fournisseur[]) ?? []);
        setChargement(false);
      });
  }, []);

  const filtres = useMemo(
    () =>
      fournisseurs.filter(
        (f) =>
          f.nom.toLowerCase().includes(recherche.toLowerCase()) ||
          f.commune.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [fournisseurs, recherche],
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Fournisseurs</h1>
      <input
        placeholder="Rechercher un fournisseur..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {chargement ? (
        <p className="text-slate-500">Chargement...</p>
      ) : filtres.length === 0 ? (
        <p className="text-slate-500">Aucun fournisseur trouvé</p>
      ) : (
        <ul className="space-y-2">
          {filtres.map((f) => (
            <li key={f.id}>
              <Link
                href={`/repertoire/fournisseurs/${f.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <span className="font-medium text-slate-900">{f.nom}</span>
                <span className="text-sm text-slate-500">{f.commune}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
