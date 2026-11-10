import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChoixSiteDepannage, type SiteDepannage } from "../nouveau/choix-site-depannage";

/// Entrée du BI Dépannage (menu) : choix du site, présenté comme la GMAO.
export default async function DepannageChoixSitePage({
  searchParams,
}: {
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "admin") redirect("/");
  const { horsContrat } = await searchParams;
  const estHorsContrat = horsContrat === "1";
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites_view")
    .select("id, nom, site, code_postal, commune, adresse, complement_adresse")
    .eq("hors_contrat", estHorsContrat)
    .order("nom");
  return <ChoixSiteDepannage sites={(data ?? []) as SiteDepannage[]} horsContrat={estHorsContrat} />;
}
