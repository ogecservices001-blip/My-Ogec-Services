"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, MapPin } from "lucide-react";
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
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {nomDecode}
      </h1>
      <p className="mb-5 text-sm text-slate-500">
        {chargement ? "Chargement..." : `${sites.length} site(s)`}
      </p>
      {chargement ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[60px] animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {sites.map((s, i) => (
            <li key={s.id} className={i > 0 ? "border-t border-slate-100" : ""}>
              <Link
                href={`/repertoire/clients/${s.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <MapPin className="h-4 w-4 text-slate-500" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">
                  {s.site || "Site sans nom"}
                </span>
                <span className="shrink-0 text-sm text-slate-400">
                  {s.commune}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
