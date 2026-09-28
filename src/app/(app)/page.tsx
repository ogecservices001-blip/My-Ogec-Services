import Link from "next/link";
import {
  Wrench,
  ClipboardList,
  BookUser,
  FileText,
  type LucideIcon,
} from "lucide-react";

const modules: {
  href: string;
  titre: string;
  sousTitre: string;
  icone: LucideIcon;
  classes: string;
  actif: boolean;
}[] = [
  {
    href: "#",
    titre: "Bon d'intervention",
    sousTitre: "Petits travaux, maintenance, dépannage",
    icone: ClipboardList,
    classes: "bg-slate-400",
    actif: false,
  },
  {
    href: "#",
    titre: "GMAO",
    sousTitre: "Parc équipements et relevés d'entretien",
    icone: Wrench,
    classes: "bg-slate-400",
    actif: false,
  },
  {
    href: "/repertoire",
    titre: "Répertoire",
    sousTitre: "Clients, fournisseurs et collaborateurs",
    icone: BookUser,
    classes: "bg-brand-green",
    actif: true,
  },
  {
    href: "#",
    titre: "CERFA",
    sousTitre: "Interventions et consultation",
    icone: FileText,
    classes: "bg-slate-400",
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
              className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.classes}`}
              >
                <m.icone className="h-5 w-5 text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{m.titre}</p>
                <p className="truncate text-sm text-slate-500">
                  {m.sousTitre}
                </p>
              </div>
            </Link>
          ) : (
            <div
              key={m.titre}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white/60 p-5 opacity-70"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.classes}`}
              >
                <m.icone className="h-5 w-5 text-white" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-600">{m.titre}</p>
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
