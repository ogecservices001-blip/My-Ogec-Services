"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profil } from "@/lib/types";

export default function CollaborateursPage() {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setProfils((data as Profil[]) ?? []);
        setChargement(false);
      });
  }, []);

  const filtres = useMemo(
    () =>
      profils.filter((p) =>
        p.name.toLowerCase().includes(recherche.toLowerCase()),
      ),
    [profils, recherche],
  );

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">
        Annuaire collaborateurs
      </h1>
      <input
        placeholder="Rechercher un collègue..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      {chargement ? (
        <p className="text-slate-500">Chargement...</p>
      ) : (
        <ul className="space-y-2">
          {filtres.map((p) => (
            <li key={p.id} className="rounded-xl bg-white shadow-sm">
              <button
                onClick={() => setOuvert(ouvert === p.id ? null : p.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="font-medium text-slate-900">{p.name}</span>
                {p.portable && (
                  <a
                    href={`tel:${p.portable}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-teal-700"
                  >
                    {p.portable}
                  </a>
                )}
              </button>
              {ouvert === p.id && (
                <div className="space-y-1 border-t border-slate-100 p-4 text-sm text-slate-700">
                  {p.email_perso && <p>Email personnel : {p.email_perso}</p>}
                  {p.commune_habitation && (
                    <p>Commune : {p.commune_habitation}</p>
                  )}
                  {p.vehicule && <p>Véhicule : {p.vehicule}</p>}
                  {p.qualite && <p>Qualité : {p.qualite}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
