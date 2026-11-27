"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Onglets({ siteId }: { siteId: string }) {
  const chemin = usePathname();
  const base = `/mon-contrat/sites/${siteId}`;
  const onglets = [
    { href: base, label: "Accueil" },
    { href: `${base}/equipements`, label: "Équipements" },
    { href: `${base}/depannages`, label: "Dépannages" },
    { href: `${base}/devis`, label: "Devis" },
    { href: `${base}/documents`, label: "Documents" },
  ];
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {onglets.map((o) => {
        const actif = o.href === base ? chemin === base : chemin.startsWith(o.href);
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              actif ? "bg-[#4f9a41] text-white shadow-sm" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
