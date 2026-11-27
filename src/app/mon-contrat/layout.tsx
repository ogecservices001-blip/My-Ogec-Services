import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Mon contrat OGEC",
  robots: { index: false, follow: false },
};

/// Espace client « Mon contrat OGEC » : hors de l'appli du personnel (ni
/// menu, ni compte), textes au vouvoiement.
export default function MonContratLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1f2a24] text-white">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-8">
          <Image src="/logo-icon.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg bg-white/90 object-contain p-0.5" />
          <p className="text-lg font-bold tracking-tight">
            Mon contrat <span className="text-[#7cc26b]">OGEC</span>
          </p>
        </div>
      </header>
      <main className="px-4 py-6 sm:px-8">{children}</main>
      <footer className="px-4 pb-8 text-center text-xs text-slate-400 sm:px-8">
        OGEC Services · 918, Chemin Tour des Roches — 97460 Saint-Paul · 0262 26 00 86 · ogec.services@orange.fr
      </footer>
    </div>
  );
}
