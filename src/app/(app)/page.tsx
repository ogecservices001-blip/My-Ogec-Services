import Link from "next/link";
import {
  Wrench,
  ClipboardList,
  BookUser,
  FileText,
  FileSignature,
  ShoppingBag,
  CalendarClock,
  Construction,
  Flag,
  LibraryBig,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const modules: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: LucideIcon;
  fond: string;
  couleur: string;
  actif: boolean;
}[] = [
  {
    href: "#",
    titre: "Bon d'intervention",
    sousTitre: "Petits travaux, maintenance, dépannage",
    icone: ClipboardList,
    fond: "bg-violet-100",
    couleur: "text-violet-600",
    actif: false,
  },
  {
    href: "#",
    titre: "GMAO",
    sousTitre: "Parc équipements et relevés d'entretien",
    icone: Wrench,
    fond: "bg-teal-100",
    couleur: "text-teal-600",
    actif: false,
  },
  {
    href: "/repertoire",
    titre: "Répertoire",
    sousTitre: "Clients, fournisseurs et collaborateurs",
    icone: BookUser,
    fond: "bg-green-100",
    couleur: "text-brand-green-dark",
    actif: true,
  },
  {
    href: "#",
    titre: "CERFA",
    sousTitre: "Interventions et consultation",
    icone: FileText,
    fond: "bg-blue-100",
    couleur: "text-blue-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Devis",
    sousTitre: "Affaires sur devis",
    icone: FileSignature,
    fond: "bg-amber-100",
    couleur: "text-amber-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Prestation sur commande",
    sousTitre: "Interventions à la demande",
    icone: ShoppingBag,
    fond: "bg-rose-100",
    couleur: "text-rose-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Planning Maintenance",
    sousTitre: "Calendrier des entretiens",
    icone: CalendarClock,
    fond: "bg-cyan-100",
    couleur: "text-cyan-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Suivi Dépannages",
    sousTitre: "Demandes reçues via QR équipement",
    icone: Construction,
    fond: "bg-red-100",
    couleur: "text-red-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Signalement retour information terrain",
    sousTitre: "Retours des collaborateurs sur l'app",
    icone: Flag,
    fond: "bg-purple-100",
    couleur: "text-purple-600",
    actif: false,
  },
  {
    href: "#",
    titre: "Référentiel GMAO",
    sousTitre: "Heures et gammes de maintenance",
    icone: LibraryBig,
    fond: "bg-lime-100",
    couleur: "text-lime-600",
    actif: false,
  },
];

export default function AccueilPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
        Accueil
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        La migration se fait module par module — Répertoire disponible
        pour l&apos;instant.
      </p>
      <div className="space-y-3">
        {modules.map((m) =>
          m.actif ? (
            <Link
              key={m.titre}
              href={m.href}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.fond}`}
              >
                <m.icone className={`h-5 w-5 ${m.couleur}`} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{m.titre}</p>
                <p className="truncate text-sm text-slate-500">
                  {m.sousTitre}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Link>
          ) : (
            <div
              key={m.titre}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 opacity-60 shadow-sm"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.fond}`}
              >
                <m.icone className={`h-5 w-5 ${m.couleur}`} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-700">{m.titre}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    Bientôt
                  </span>
                </div>
                <p className="truncate text-sm text-slate-400">
                  {m.sousTitre}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
