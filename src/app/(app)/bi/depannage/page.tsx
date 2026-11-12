import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChoixSiteDepannage, type SiteDepannage, type TicketOuvert } from "../nouveau/choix-site-depannage";

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
  const [{ data }, { data: tickets }, { data: brouillons }] = await Promise.all([
    supabase
      .from("sites_view")
      .select("id, nom, site, code_postal, commune, adresse, complement_adresse")
      .eq("hors_contrat", estHorsContrat)
      .order("nom"),
    supabase
      .from("demandes_depannage")
      .select("id, numero, site_id, equipement_nom, message")
      .neq("statut", "traitee")
      .not("site_id", "is", null),
    supabase.from("bons_intervention").select("id, depannage_id").eq("statut", "brouillon").not("depannage_id", "is", null),
  ]);
  const brouillonParTicket = new Map((brouillons ?? []).map((b) => [b.depannage_id as string, b.id]));
  const ticketsOuverts: TicketOuvert[] = (tickets ?? []).map((t) => ({
    id: t.id,
    numero: t.numero,
    site_id: t.site_id as string,
    equipement_nom: t.equipement_nom,
    message: t.message,
    brouillonId: brouillonParTicket.get(t.id) ?? null,
  }));
  return <ChoixSiteDepannage sites={(data ?? []) as SiteDepannage[]} horsContrat={estHorsContrat} ticketsOuverts={ticketsOuverts} />;
}
