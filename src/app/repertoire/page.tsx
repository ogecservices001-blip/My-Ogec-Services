import Link from "next/link";

const cartes = [
  {
    href: "/repertoire/clients",
    titre: "Clients contrat entretien",
    couleur: "bg-green-700",
  },
  {
    href: "/repertoire/clients?horsContrat=1",
    titre: "Clients hors contrat",
    couleur: "bg-orange-600",
  },
  {
    href: "/repertoire/fournisseurs",
    titre: "Fournisseurs",
    couleur: "bg-slate-600",
  },
  {
    href: "/repertoire/collaborateurs",
    titre: "Collaborateurs",
    couleur: "bg-indigo-600",
  },
];

export default function RepertoirePage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Répertoire</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {cartes.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className={`mb-3 inline-block h-2 w-10 rounded-full ${c.couleur}`} />
            <p className="font-semibold text-slate-900">{c.titre}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
