"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

type SousMenu = { nom: string; href: string };
type Module = { nom: string; actif: boolean; sousMenus: SousMenu[] };

const modules: Module[] = [
  { nom: "Bon d'intervention", actif: false, sousMenus: [] },
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
];

function SidebarContenu({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cheminActuel =
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");

  return (
    <nav className="space-y-5">
      {modules.map((m) => (
        <div key={m.nom}>
          <div className="mb-1.5 flex items-center gap-2 px-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {m.nom}
            </p>
            {!m.actif && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                Bientôt
              </span>
            )}
          </div>
          {m.actif && (
            <ul className="space-y-0.5">
              {m.sousMenus.map((s) => {
                const actif = cheminActuel === s.href;
                return (
                  <li key={s.href}>
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
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { ouvert, fermer } = useSidebar();

  return (
    <>
      {/* Desktop : colonne fixe à droite */}
      <aside className="hidden w-60 shrink-0 border-l border-slate-200 bg-white px-4 py-6 lg:block">
        <Suspense fallback={null}>
          <SidebarContenu onNavigate={() => {}} />
        </Suspense>
      </aside>

      {/* Mobile : tiroir qui glisse depuis la droite */}
      {ouvert && (
        <div className="fixed inset-0 z-20 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={fermer}
          />
          <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-white px-4 py-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
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
