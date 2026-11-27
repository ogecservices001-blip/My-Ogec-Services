import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { BoutonDeconnexion } from "../bouton-deconnexion";
import { Onglets } from "./onglets";

export const dynamic = "force-dynamic";

export default async function SiteClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site, plusieursSites } = await accesSite(id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {plusieursSites && (
            <Link href="/mon-contrat/sites" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" /> Vos sites
            </Link>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{site.site || site.nom}</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            {[site.nom, site.adresse, [site.code_postal, site.commune].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <BoutonDeconnexion />
      </div>
      <Onglets siteId={id} />
      {children}
    </div>
  );
}
