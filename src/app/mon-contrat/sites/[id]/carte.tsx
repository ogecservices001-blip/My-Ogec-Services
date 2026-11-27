import type { LucideIcon } from "lucide-react";

export const jourLong = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const jourCourt = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "—");

export function Carte({ titre, icone: Icone, children, action }: { titre: string; icone: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Icone className="h-4 w-4 text-[#4f9a41]" />
          {titre}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
