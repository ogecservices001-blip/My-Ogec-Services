import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";

const COLONNES: ColonneTableur[] = [
  { titre: "Item", largeur: "10%" },
  { titre: "Client", largeur: "30%" },
  { titre: "Site", largeur: "35%" },
  { titre: "N° Affaire (legacy)", largeur: "25%" },
];

export default async function ReferentielPostesHorsClientPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("postes_hors_client").select("*").order("item");
  const postes = data ?? [];

  return (
    <div>
      <Link
        href="/planning"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <div className="mb-4">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Postes hors client</h1>
        <p className="text-sm text-slate-500">
          Travail planifiable qui n&apos;est rattaché à aucun client (formation, absences, bureau...) — proposé dans
          &laquo;&nbsp;Nouveau créneau&nbsp;&raquo; du planning.
        </p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={postes.map((p) => [p.item, p.client, p.site, p.numero_legacy])}
        vide="Aucun poste hors client"
      />
      <p className="mt-4 text-xs text-slate-400">
        Pour ajouter, renommer ou retirer un poste, demande la modification — c&apos;est une courte liste de
        référence gérée directement en base.
      </p>
    </div>
  );
}
