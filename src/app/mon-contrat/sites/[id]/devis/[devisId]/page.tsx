import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { devisClient } from "@/lib/espace-client/donnees-parc";
import { jourCourt } from "../../carte";
import { FormulaireAccord } from "./formulaire-accord";

export const dynamic = "force-dynamic";

export default async function AccordDevisPage({ params }: { params: Promise<{ id: string; devisId: string }> }) {
  const { id, devisId } = await params;
  const { admin, site, email } = await accesSite(id);
  const devis = (await devisClient(admin, site.id)).find((d) => d.id === devisId);
  if (!devis) notFound();
  const { data: brut } = await admin.from("devis").select("numero, envoyee_le").eq("id", devisId).single();

  return (
    <div className="space-y-4">
      <Link href={`/mon-contrat/sites/${site.id}/devis`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Vos devis
      </Link>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Devis n° {brut?.numero}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{devis.objet}</p>
        <p className="text-sm text-slate-500">
          Devis du {jourCourt(devis.date)}
          {brut?.envoyee_le ? ` · détail chiffré adressé par email le ${brut.envoyee_le}` : ""}
        </p>
      </div>
      {devis.attenteAccord ? (
        <FormulaireAccord siteId={site.id} devisId={devisId} email={email} numero={brut?.numero ?? ""} />
      ) : (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">État de ce devis : {devis.etat}.</p>
      )}
    </div>
  );
}
