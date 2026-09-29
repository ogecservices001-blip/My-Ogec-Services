import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { Site } from "@/lib/types";
import { SiteForm } from "../../site-form";

export default async function ModifierSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.from("sites").select("*").eq("id", id).single();
  if (!data) notFound();
  const site = data as Site;

  return (
    <div>
      <Link
        href={`/repertoire/clients/${id}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        {site.nom}
      </h1>
      <p className="mb-5 text-lg font-semibold text-blue-600">{site.site}</p>
      <SiteForm site={site} />
    </div>
  );
}
