"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Site } from "@/lib/types";

export default function SitesDuClientPage({
  params,
}: {
  params: Promise<{ nom: string }>;
}) {
  const { nom } = use(params);
  const nomDecode = decodeURIComponent(nom);
  const searchParams = useSearchParams();
  const horsContrat = searchParams.get("horsContrat") === "1";

  const [sites, setSites] = useState<Site[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("sites_view")
      .select("*")
      .eq("nom", nomDecode)
      .eq("hors_contrat", horsContrat)
      .order("site")
      .then(({ data }) => {
        setSites((data as Site[]) ?? []);
        setChargement(false);
      });
  }, [nomDecode, horsContrat]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">{nomDecode}</h1>
      {chargement ? (
        <p className="text-slate-500">Chargement...</p>
      ) : (
        <ul className="space-y-2">
          {sites.map((s) => (
            <li key={s.id}>
              <Link
                href={`/repertoire/clients/${s.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
              >
                <span className="font-medium text-slate-900">
                  {s.site || "Site sans nom"}
                </span>
                <span className="text-sm text-slate-500">{s.commune}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
