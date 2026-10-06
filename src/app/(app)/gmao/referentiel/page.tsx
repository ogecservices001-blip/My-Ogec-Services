import { requireAdminOuAccueil } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, Clock, Wrench, ChevronRight, type LucideIcon } from "lucide-react";

const cartes: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: LucideIcon;
  fond: string;
  couleur: string;
}[] = [
  {
    href: "/gmao/referentiel/heures",
    titre: "Heures de référence",
    sousTitre: "Base horaire Tech/Assistant par équipement",
    icone: Clock,
    fond: "bg-teal-100",
    couleur: "text-teal-600",
  },
  {
    href: "/gmao/referentiel/familles",
    titre: "Gammes de maintenance",
    sousTitre: "Familles d'équipement et checklists d'entretien",
    icone: Wrench,
    fond: "bg-indigo-100",
    couleur: "text-indigo-600",
  },
];

export default async function ReferentielGmaoPage() {
  await requireAdminOuAccueil();
  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Référentiel GMAO</h1>
      <p className="mb-6 text-sm text-slate-500">Heures et gammes de maintenance</p>
      <div className="space-y-3">
        {cartes.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.fond}`}
            >
              <c.icone className={`h-5 w-5 ${c.couleur}`} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{c.titre}</p>
              <p className="truncate text-sm text-slate-500">{c.sousTitre}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
