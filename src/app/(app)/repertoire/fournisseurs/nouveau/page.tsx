import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminOuAccueil } from "@/lib/auth";
import { FournisseurForm } from "../fournisseur-form";

export default async function NouveauFournisseurPage() {
  await requireAdminOuAccueil();

  return (
    <div>
      <Link
        href="/repertoire/fournisseurs"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-slate-900">
        Nouveau fournisseur
      </h1>
      <FournisseurForm />
    </div>
  );
}
