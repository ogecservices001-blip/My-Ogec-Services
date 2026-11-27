import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte, sitesAutorises } from "@/lib/espace-client/acces";
import { BoutonDeconnexion } from "./bouton-deconnexion";

export const dynamic = "force-dynamic";

export default async function MesSitesPage() {
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) redirect("/mon-contrat");
  const sites = await sitesAutorises(admin, email);
  if (sites.length === 1) redirect(`/mon-contrat/sites/${sites[0].id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vos sites</h1>
          <p className="text-sm text-slate-500">Connecté avec {email}</p>
        </div>
        <BoutonDeconnexion />
      </div>
      {sites.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Aucun site n&apos;est ouvert pour cette adresse. Contactez-nous à ogec.services@orange.fr.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/mon-contrat/sites/${s.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef6ec]">
                <Building2 className="h-5 w-5 text-[#3d7a32]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-slate-900">{s.site || s.nom}</span>
                <span className="block truncate text-sm text-slate-500">
                  {[s.nom, s.commune].filter(Boolean).join(" · ")}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
