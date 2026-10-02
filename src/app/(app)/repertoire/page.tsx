import Link from "next/link";
import {
  ArrowLeft,
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
  fond: string;
  couleur: string;
}[] = [
  {
    href: "/repertoire/clients",
    titre: "Clients",
    sousTitre: "Sous contrat",
    icone: Building2,
    fond: "bg-green-100",
    couleur: "text-brand-green-dark",
  },
  {
    href: "/repertoire/clients?horsContrat=1",
    titre: "Clients",
    sousTitre: "Hors contrat",
    icone: Building,
    fond: "bg-orange-100",
    couleur: "text-orange-600",
  },
  {
    href: "/repertoire/fournisseurs",
    titre: "Fournisseurs",
    sousTitre: "Contacts et produits",
    icone: Truck,
    fond: "bg-slate-100",
    couleur: "text-brand-slate-dark",
  },
  {
    href: "/repertoire/collaborateurs",
    titre: "Collaborateurs",
    sousTitre: "Annuaire de l'équipe",
    icone: Users,
    fond: "bg-indigo-100",
    couleur: "text-indigo-600",
  },
];

export default function RepertoirePage() {
  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Répertoire
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Clients, fournisseurs et collaborateurs
      </p>
      <div className="space-y-3">
        {cartes.map((c) => (
          <Link
            key={c.href + c.sousTitre}
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
