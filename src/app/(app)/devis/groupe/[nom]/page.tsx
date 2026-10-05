import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import type { Site } from "@/lib/types";
import { ListeRegistreDevis, eur, type DevisRegistreLigne } from "../../registre-liste";
import { STATUTS_BI_REALISE } from "../../statut";

export default async function DevisDuClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ nom: string }>;
  searchParams: Promise<{ horsContrat?: string }>;
}) {
  const { nom } = await params;
  const nomDecode = decodeURIComponent(nom);
  const { horsContrat: horsContratParam } = await searchParams;
  const horsContrat = horsContratParam === "1";

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const { data } = await supabase
    .from("sites_view")
    .select("*")
    .eq("nom", nomDecode)
    .eq("hors_contrat", horsContrat)
    .order("site");
  const sites = (data as Site[]) ?? [];
  const siteParId = new Map(sites.map((s) => [s.id, s]));

  const siteIds = sites.map((s) => s.id);
  const [{ data: devis }, { data: bons }] = await Promise.all([
    supabase.from("devis").select("*").in("site_id", siteIds).order("created_at", { ascending: false }),
    supabase.from("bons_intervention").select("devis_id, statut").in("site_id", siteIds),
  ]);
  const devisRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_BI_REALISE.has(b.statut)).map((b) => b.devis_id as string),
  );

  const lignes: DevisRegistreLigne[] = (devis ?? []).map((d) => {
    const site = siteParId.get(d.site_id);
    return {
      id: d.id,
      numero: d.numero,
      clientNom: nomDecode,
      clientSite: site?.site ?? "",
      libelle: d.libelle,
      nature: d.nature,
      montant: d.montant,
      dateDevis: d.date_devis,
      commande: Boolean(d.date_commande_client),
      realise: devisRealises.has(d.id),
      annule: d.annule,
    };
  });

  const actifs = lignes.filter((l) => !l.annule);
  const commandes = actifs.filter((l) => l.commande);
  const montantTotal = actifs.reduce((s, l) => s + (l.montant ?? 0), 0);
  const montantCommande = commandes.reduce((s, l) => s + (l.montant ?? 0), 0);

  return (
    <div>
      <Link
        href={`/devis/par-client?horsContrat=${horsContrat ? "1" : "0"}`}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{nomDecode}</h1>
      <p className="mb-5 text-sm text-slate-500">
        {actifs.length} devis · {commandes.length} commandé(s)
        {isAdmin && ` · ${eur(montantTotal)}`}
      </p>

      {lignes.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Aucun devis pour ce client pour l&apos;instant</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-lg font-bold text-slate-900">{actifs.length}</p>
              <p className="text-xs text-slate-500">Devis</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-lg font-bold text-brand-green-dark">
                {commandes.length}
                <span className="text-sm font-semibold text-slate-400">
                  {" "}
                  /{actifs.length > 0 ? Math.round((commandes.length / actifs.length) * 100) : 0}%
                </span>
              </p>
              <p className="text-xs text-slate-500">Commandés</p>
            </div>
            {isAdmin && (
              <>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-lg font-bold text-slate-900">{eur(montantTotal)}</p>
                  <p className="text-xs text-slate-500">Montant total</p>
                </div>
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-lg font-bold text-amber-600">{eur(montantTotal - montantCommande)}</p>
                  <p className="text-xs text-slate-500">En attente</p>
                </div>
              </>
            )}
          </div>

          <ListeRegistreDevis lignes={lignes} masquerClient isAdmin={isAdmin} />
        </>
      )}
    </div>
  );
}
