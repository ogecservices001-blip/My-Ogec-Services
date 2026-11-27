import Link from "next/link";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoutonCouper } from "./bouton-couper";

const quand = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "short", timeStyle: "short" }) : "—";

/// Tous les accès « Mon contrat OGEC » ouverts par le bureau.
export default async function AccesClientsPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const [{ data: acces }, { data: sites }] = await Promise.all([
    supabase.from("acces_clients").select("*").order("created_at", { ascending: false }),
    supabase.from("sites").select("id, nom, site"),
  ]);
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const actifs = (acces ?? []).filter((a) => !a.revoque_le);
  const coupes = (acces ?? []).filter((a) => a.revoque_le);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accès Mon contrat OGEC</h1>
        <p className="text-sm text-slate-500">
          Contacts clients qui peuvent consulter leur espace. Pour ouvrir un accès : fiche du site, bloc « Mon contrat OGEC ».
          Adresse de l&apos;espace pour les clients : <span className="font-semibold">/mon-contrat</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="border-b border-slate-200 px-4 py-2">Client — Site</th>
              <th className="border-b border-slate-200 px-4 py-2">Contact</th>
              <th className="border-b border-slate-200 px-4 py-2">Invité le</th>
              <th className="border-b border-slate-200 px-4 py-2">Dernière connexion</th>
              <th className="border-b border-slate-200 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {actifs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Aucun accès ouvert pour l&apos;instant.
                </td>
              </tr>
            )}
            {actifs.map((a) => {
              const s = siteParId.get(a.site_id);
              return (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={`/repertoire/clients/${a.site_id}`} className="font-semibold text-slate-800 hover:underline">
                      {[s?.nom, s?.site].filter(Boolean).join(" — ") || "Site"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {a.nom ? `${a.nom} · ` : ""}
                    {a.email}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{quand(a.invite_le)}</td>
                  <td className="px-4 py-2 text-slate-500">{a.derniere_connexion ? quand(a.derniere_connexion) : "Jamais"}</td>
                  <td className="px-4 py-2 text-right">
                    <BoutonCouper siteId={a.site_id} email={a.email} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {coupes.length > 0 && (
        <p className="text-xs text-slate-400">
          Accès coupés : {coupes.map((a) => `${a.email} (${siteParId.get(a.site_id)?.site ?? "site"})`).join(" · ")}
        </p>
      )}
    </div>
  );
}
