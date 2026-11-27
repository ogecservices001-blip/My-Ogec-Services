import { FolderOpen } from "lucide-react";
import { accesSite } from "@/lib/espace-client/session-site";
import { documentsClient } from "@/lib/espace-client/donnees-parc";
import { Carte, Vide, jourCourt } from "../carte";

export const dynamic = "force-dynamic";

export default async function DocumentsClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, site } = await accesSite(id);
  const documents = await documentsClient(admin, site.id);

  return (
    <Carte titre="Vos documents" icone={FolderOpen}>
      {documents.length === 0 ? (
        <Vide>Vos bons d&apos;intervention, rapports de visite et contrôles d&apos;étanchéité apparaîtront ici.</Vide>
      ) : (
        <ul className="divide-y divide-slate-100">
          {documents.map((d) => (
            <li key={d.cle}>
              <a href={d.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2.5 hover:bg-slate-50">
                <span className="w-24 shrink-0 text-sm font-semibold text-slate-700">{jourCourt(d.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">{d.titre}</span>
                  <span className="block truncate text-xs text-slate-500">{d.detail}</span>
                </span>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">PDF</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
