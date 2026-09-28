import Link from "next/link";
import {
  Building2,
  Building,
  Truck,
  Users,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const cartes: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: LucideIcon;
  couleur: string;
  fond: string;
}[] = [
  {
    href: "/repertoire/clients",
    titre: "Clients contrat entretien",
    sousTitre: "Sites sous contrat",
    icone: Building2,
    couleur: "text-emerald-600",
    fond: "bg-emerald-50",
  },
  {
    href: "/repertoire/clients?horsContrat=1",
    titre: "Clients hors contrat",
    sousTitre: "Interventions ponctuelles",
    icone: Building,
    couleur: "text-orange-600",
    fond: "bg-orange-50",
  },
  {
    href: "/repertoire/fournisseurs",
    titre: "Fournisseurs",
    sousTitre: "Contacts et produits",
    icone: Truck,
    couleur: "text-slate-600",
    fond: "bg-slate-100",
  },
  {
    href: "/repertoire/collaborateurs",
    titre: "Collaborateurs",
    sousTitre: "Annuaire de l'équipe",
    icone: Users,
    couleur: "text-indigo-600",
    fond: "bg-indigo-50",
  },
];

export default function RepertoirePage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Répertoire
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Clients, fournisseurs et collaborateurs
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cartes.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.fond}`}
            >
              <c.icone className={`h-5 w-5 ${c.couleur}`} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">
                {c.titre}
              </p>
              <p className="truncate text-sm text-slate-500">
                {c.sousTitre}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}
