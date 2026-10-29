import { requireAdminOuAccueil } from "@/lib/auth";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import type { TypeEquipement, ChecklistItem } from "@/lib/gmao/types";

function chipChecklist(item: ChecklistItem) {
  switch (item.typeValeur) {
    case "enum":
      return { label: item.options.join(" / "), classe: "text-orange-600" };
    case "text":
      return { label: "Texte", classe: "text-slate-500" };
    default:
      return { label: "Effectué", classe: "text-brand-green-dark" };
  }
}

const COLONNES_CHAMPS: ColonneTableur[] = [{ titre: "Champ" }, { titre: "Type", largeur: "140px" }];
const COLONNES_CHECKLIST: ColonneTableur[] = [
  { titre: "N°", largeur: "60px" },
  { titre: "Opération" },
  { titre: "Type", largeur: "200px" },
];
const COLONNES_MESURES: ColonneTableur[] = [{ titre: "Groupe" }, { titre: "Répétable", largeur: "130px" }, { titre: "Champs" }];

export default async function FamilleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminOuAccueil();
  const supabase = await createClient();
  const { data } = await supabase.from("types_equipement").select("*").eq("id", id).single();

  if (!data) notFound();
  const famille = data as TypeEquipement;

  return (
    <div>
      <FilAjouter maillons={[{ nom: famille.nom }]} />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">{famille.nom}</h1>
      <p className="mb-5 text-sm text-slate-500">{famille.code}</p>

      {famille.champs_en_tete_supplementaires.length > 0 && (
        <>
          <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Champs d&apos;en-tête spécifiques</h2>
          <Tableur
            colonnes={COLONNES_CHAMPS}
            lignes={famille.champs_en_tete_supplementaires.map((c) => [
              c.label,
              c.options.length === 0 ? "Texte" : `${c.options.length} choix`,
            ])}
            valeurs={famille.champs_en_tete_supplementaires.map((c) => [c.label])}
            vide="Aucun champ"
          />
        </>
      )}

      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
        Checklist d&apos;entretien ({famille.checklist.length})
      </h2>
      <Tableur
        colonnes={COLONNES_CHECKLIST}
        lignes={famille.checklist.map((item) => {
          const chip = chipChecklist(item);
          return [item.rep, item.label, <span key="type" className={chip.classe}>{chip.label}</span>];
        })}
        valeurs={famille.checklist.map((item) => [item.rep, item.label])}
        vide="Aucune opération"
      />

      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
        Groupes de mesures ({famille.groupes_mesures.length})
      </h2>
      <Tableur
        colonnes={COLONNES_MESURES}
        lignes={famille.groupes_mesures.map((groupe) => [
          groupe.label,
          groupe.repetable ? `Oui × ${groupe.nombreMax}` : "Non",
          groupe.champs.map((c) => (c.unite ? `${c.label} (${c.unite})` : c.label)).join(", "),
        ])}
        valeurs={famille.groupes_mesures.map((groupe) => [groupe.label])}
        vide="Aucun groupe de mesures"
      />
    </div>
  );
}
