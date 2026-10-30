"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X, ChevronRight, ChevronDown } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";
import { construireModules, type Module } from "@/lib/menus";

const COLLAPSED = 56;
const EXPANDED = 220;
const FLYOUT_WIDTH = 280;

/// Un sous-menu correspond au chemin actuel soit à l'identique (avec
/// ses paramètres — ex. "?horsContrat=1"), soit comme préfixe de page
/// de détail (ex. "/bi/abc123" sous "/bi") — pour que le module se
/// déplie automatiquement même en arrivant sur une fiche.
function correspond(href: string, pathname: string, cheminActuel: string): boolean {
  if (cheminActuel === href) return true;
  const base = href.split("?")[0];
  return base !== "/" && (pathname === base || pathname.startsWith(`${base}/`));
}

function moduleActif(m: Module, pathname: string, cheminActuel: string): boolean {
  return m.sousMenus.some((s) => s.href && correspond(s.href, pathname, cheminActuel));
}

function DesktopSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cheminActuel = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const modules = construireModules(isAdmin);

  const [hovered, setHovered] = useState(false);
  const [activeNav, setActiveNav] = useState<string | null>(
    () => modules.find((m) => moduleActif(m, pathname, cheminActuel))?.nom ?? null,
  );

  const expanded = hovered || !!activeNav;
  const flyoutModule = activeNav ? modules.find((m) => m.nom === activeNav) ?? null : null;
  const hasFlyout = !!flyoutModule && flyoutModule.sousMenus.length > 0;

  function clicModule(m: Module) {
    if (!m.actif || m.sousMenus.length === 0) return;
    setActiveNav((prev) => (prev === m.nom ? null : m.nom));
  }

  function survolModule(m: Module) {
    if (activeNav !== null && m.actif && m.sousMenus.length > 0) setActiveNav(m.nom);
  }

  return (
    <div
      className="relative hidden shrink-0 lg:block"
      style={{ width: COLLAPSED, zIndex: 20 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <aside
        className="absolute left-0 top-0 flex select-none flex-col overflow-hidden"
        style={{
          width: expanded ? EXPANDED : COLLAPSED,
          minHeight: "calc(100vh - 52px)",
          transition: "width 0.2s ease",
          backgroundColor: "var(--shell-bg)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {modules.map((m) => {
            const Icon = m.icone;
            const actif = moduleActif(m, pathname, cheminActuel);
            const ouvert = activeNav === m.nom;
            return (
              <button
                key={m.nom}
                onClick={() => clicModule(m)}
                onMouseEnter={() => survolModule(m)}
                disabled={!m.actif}
                title={!expanded ? m.nom : undefined}
                className="flex w-full items-center overflow-hidden rounded-md transition-colors"
                style={{
                  gap: expanded ? 10 : 0,
                  height: 38,
                  paddingLeft: expanded ? 10 : 0,
                  paddingRight: expanded ? 10 : 0,
                  justifyContent: expanded ? "flex-start" : "center",
                  backgroundColor: actif || ouvert ? "rgba(62,207,142,0.1)" : "transparent",
                  color: !m.actif ? "#4b4b4b" : actif || ouvert ? "#ffffff" : "#9a9a9a",
                  cursor: m.actif ? "pointer" : "default",
                }}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                <span
                  className="truncate text-sm"
                  style={{
                    opacity: expanded ? 1 : 0,
                    width: expanded ? "auto" : 0,
                    whiteSpace: "nowrap",
                    transition: "opacity 0.15s ease",
                    fontWeight: actif || ouvert ? 700 : 400,
                  }}
                >
                  {m.nom}
                </span>
                {expanded && !m.actif && (
                  <span className="ml-auto shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Bientôt
                  </span>
                )}
                {expanded && m.actif && m.sousMenus.length > 0 && (
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" style={{ color: "#505050" }} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Volet des sous-menus */}
      <div
        className="absolute top-0 flex flex-col overflow-hidden"
        style={{
          left: EXPANDED,
          width: hasFlyout ? FLYOUT_WIDTH : 0,
          opacity: hasFlyout ? 1 : 0,
          minHeight: "calc(100vh - 52px)",
          transition: "width 0.2s ease, opacity 0.15s ease",
          backgroundColor: "var(--shell-bg-raised)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: hasFlyout ? "4px 0 20px rgba(0,0,0,0.3)" : "none",
          zIndex: 15,
        }}
      >
        {flyoutModule && (
          <>
            <p className="px-4 pb-2 pt-4 text-xs font-medium uppercase tracking-wider" style={{ color: "#505050" }}>
              {flyoutModule.nom}
            </p>
            <div className="flex flex-1 flex-col gap-0.5 px-2 pb-3">
              {flyoutModule.sousMenus.map((s) => {
                if (!s.href) {
                  return (
                    <span key={s.nom} className="rounded-md px-3 py-2 text-sm text-slate-600">
                      {s.nom}
                    </span>
                  );
                }
                const actif = cheminActuel === s.href;
                return (
                  <Link
                    key={s.nom}
                    href={s.href}
                    onClick={() => setActiveNav(null)}
                    className="rounded-md px-3 py-2 text-sm transition-colors"
                    style={{
                      color: actif ? "#ffffff" : "#9a9a9a",
                      backgroundColor: actif ? "rgba(62,207,142,0.1)" : "transparent",
                      fontWeight: actif ? 700 : 400,
                    }}
                  >
                    {s.nom}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Clic en dehors pour refermer le volet */}
      {hasFlyout && <div className="fixed inset-0" style={{ zIndex: 10 }} onClick={() => setActiveNav(null)} />}
    </div>
  );
}

function MobileSidebarContenu({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cheminActuel = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
  const modules = construireModules(isAdmin);

  const [deplies, setDeplies] = useState<Set<string>>(() => {
    const initial = modules.find((m) => moduleActif(m, pathname, cheminActuel));
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
    <nav className="space-y-0.5">
      {modules.map((m) => {
        const Icon = m.icone;
        const deplie = deplies.has(m.nom);
        const peutDeplier = m.actif && m.sousMenus.length > 0;
        const actifModule = moduleActif(m, pathname, cheminActuel);
        return (
          <div key={m.nom}>
            <button
              onClick={() => peutDeplier && basculer(m.nom)}
              disabled={!peutDeplier}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors"
              style={{
                color: !m.actif ? "#4b4b4b" : actifModule ? "#ffffff" : "#d4d4d4",
                fontWeight: actifModule ? 700 : 400,
                backgroundColor: actifModule ? "rgba(62,207,142,0.1)" : "transparent",
              }}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
                {m.nom}
                {!m.actif && (
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Bientôt
                  </span>
                )}
              </span>
              {peutDeplier && (
                <ChevronDown
                  className="h-4 w-4 shrink-0 transition-transform"
                  style={{ color: "#505050", transform: deplie ? "rotate(180deg)" : "none" }}
                />
              )}
            </button>
            {peutDeplier && deplie && (
              <ul className="mb-1 mt-0.5 space-y-0.5 pl-9">
                {m.sousMenus.map((s) => {
                  const actif = !!s.href && cheminActuel === s.href;
                  if (!s.href) {
                    return (
                      <li key={s.nom}>
                        <span className="block cursor-default rounded-md px-3 py-2 text-sm text-slate-600">{s.nom}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={s.nom}>
                      <Link
                        href={s.href}
                        onClick={onNavigate}
                        className="block rounded-md px-3 py-2 text-sm transition-colors"
                        style={{
                          color: actif ? "#ffffff" : "#9a9a9a",
                          backgroundColor: actif ? "rgba(62,207,142,0.1)" : "transparent",
                          fontWeight: actif ? 700 : 400,
                        }}
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

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const { ouvert, fermer } = useSidebar();

  return (
    <>
      {/* Desktop : rail qui s'élargit au survol + volet de sous-menus */}
      <Suspense fallback={<div className="hidden shrink-0 lg:block" style={{ width: COLLAPSED, backgroundColor: "var(--shell-bg)" }} />}>
        <DesktopSidebar isAdmin={isAdmin} />
      </Suspense>

      {/* Mobile : tiroir qui glisse depuis la gauche */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={fermer} />
          <div
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto px-3 py-5 shadow-xl"
            style={{ backgroundColor: "var(--shell-bg)" }}
          >
            <div className="mb-4 flex items-center justify-between px-1">
              <p className="text-sm font-bold text-white">Menu</p>
              <button
                onClick={fermer}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5"
              >
                <X className="h-4.5 w-4.5" strokeWidth={2} />
              </button>
            </div>
            <Suspense fallback={null}>
              <MobileSidebarContenu isAdmin={isAdmin} onNavigate={fermer} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
