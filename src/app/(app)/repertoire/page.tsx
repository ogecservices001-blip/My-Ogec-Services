import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Building,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

const cartes: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: LucideIcon;
  classes: string;
}[] = [
  {
    href: "/repertoire/clients",
    titre: "Clients",
    sousTitre: "Contrat entretien",
    icone: Building2,
    classes: "bg-brand-green",
  },
  {
    href: "/repertoire/clients?horsContrat=1",
    titre: "Clients",
    sousTitre: "Hors contrat",
    icone: Building,
    classes: "bg-orange-500",
  },
  {
    href: "/repertoire/fournisseurs",
    titre: "Fournisseurs",
    sousTitre: "Contacts et produits",
    icone: Truck,
    classes: "bg-brand-slate",
  },
  {
    href: "/repertoire/collaborateurs",
    titre: "Collaborateurs",
    sousTitre: "Annuaire de l'équipe",
    icone: Users,
    classes: "bg-indigo-600",
  },
];

export default function RepertoirePage() {
  return (
    <div>
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Répertoire
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Clients, fournisseurs et collaborateurs
      </p>
      <div className="grid grid-cols-2 gap-3">
        {cartes.map((c) => (
          <Link
            key={c.href + c.sousTitre}
            href={c.href}
            className={`group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:aspect-square sm:p-5 ${c.classes}`}
          >
            <c.icone
              className="h-7 w-7 text-white/90 sm:h-8 sm:w-8"
              strokeWidth={1.75}
            />
            <c.icone
              className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 text-white/10 transition group-hover:scale-110 sm:h-28 sm:w-28"
              strokeWidth={1}
            />
            <div className="relative">
              <p className="text-base font-bold leading-tight text-white sm:text-lg">
                {c.titre}
              </p>
              <p className="text-xs text-white/80 sm:text-sm">
                {c.sousTitre}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
