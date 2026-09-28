"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

type SousMenu = { nom: string; href?: string };
type Module = { nom: string; actif: boolean; sousMenus: SousMenu[] };

const modules: Module[] = [
  {
    nom: "Bon d'intervention",
    actif: false,
    sousMenus: [
      { nom: "Dépannage" },
      { nom: "Remplacement à l'identique" },
      { nom: "Installation neuve" },
      { nom: "Réparation d'un équipement" },
      { nom: "Réparation diverse" },
      { nom: "Entretien sous contrat" },
      { nom: "Entretien hors contrat" },
      { nom: "Mise à disposition d'équipement" },
      { nom: "Livraison de matériel" },
    ],
  },
  { nom: "GMAO", actif: false, sousMenus: [] },
  {
    nom: "Répertoire",
    actif: true,
    sousMenus: [
      { nom: "Clients contrat entretien", href: "/repertoire/clients" },
      { nom: "Clients hors contrat", href: "/repertoire/clients?horsContrat=1" },
      { nom: "Fournisseurs", href: "/repertoire/fournisseurs" },
      { nom: "Collaborateurs", href: "/repertoire/collaborateurs" },
    ],
  },
  { nom: "CERFA", actif: false, sousMenus: [] },
  { nom: "Devis", actif: false, sousMenus: [] },
  { nom: "Prestation sur commande", actif: false, sousMenus: [] },
  { nom: "Planning Maintenance", actif: false, sousMenus: [] },
];

function SidebarContenu({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cheminActuel =
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");

  // Le module contenant l'écran courant démarre déplié, les autres
  // repliés — on clique sur un module (actif ou non) pour voir ses
  // sous-menus, même ceux pas encore construits (aperçu de la
  // structure à venir).
  const [deplies, setDeplies] = useState<Set<string>>(() => {
    const initial = modules.find((m) =>
      m.sousMenus.some((s) => s.href === cheminActuel),
    );
    return new Set(initial ? [initial.nom] : []);
  });

  function basculer(nom: string) {
    setDeplies((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });
  }

  return (
    <nav className="space-y-1">
      {modules.map((m) => {
        const deplie = deplies.has(m.nom);
        const peutDeplier = m.sousMenus.length > 0;
        return (
          <div key={m.nom}>
            <button
              onClick={() => peutDeplier && basculer(m.nom)}
              disabled={!peutDeplier}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                m.actif
                  ? "text-slate-800 hover:bg-slate-50"
                  : "cursor-default text-slate-400 hover:bg-slate-50/60"
              }`}
            >
              <span className="flex items-center gap-2">
                {m.nom}
                {!m.actif && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    Bientôt
                  </span>
                )}
              </span>
              {peutDeplier && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                    deplie ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
            {peutDeplier && deplie && (
              <ul className="mb-1 mt-0.5 space-y-0.5 pl-3">
                {m.sousMenus.map((s) => {
                  const actif = !!s.href && cheminActuel === s.href;
                  if (!s.href) {
                    return (
                      <li key={s.nom}>
                        <span className="block cursor-default rounded-lg px-3 py-2 text-sm text-slate-400">
                          {s.nom}
                        </span>
                      </li>
                    );
                  }
                  return (
                    <li key={s.nom}>
                      <Link
                        href={s.href}
                        onClick={onNavigate}
                        className={`block rounded-lg px-3 py-2 text-sm transition ${
                          actif
                            ? "bg-brand-green/10 font-semibold text-brand-green-dark"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {s.nom}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { ouvert, fermer } = useSidebar();

  return (
    <>
      {/* Desktop : colonne fixe à gauche */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white px-3 py-6 lg:block">
        <Suspense fallback={null}>
          <SidebarContenu onNavigate={() => {}} />
        </Suspense>
      </aside>

      {/* Mobile : tiroir qui glisse depuis la gauche */}
      {ouvert && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={fermer}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-white px-3 py-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between px-1">
              <p className="text-sm font-bold text-slate-900">Menu</p>
              <button
                onClick={fermer}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            </div>
            <Suspense fallback={null}>
              <SidebarContenu onNavigate={fermer} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
