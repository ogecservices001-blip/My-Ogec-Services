import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { FilAjouter } from "@/components/fil-extra-context";
import { Statuts } from "@/lib/bi/constants";
import { eur } from "@/lib/bi/format";
import { formaterDate } from "@/lib/format";
import { labelNatureDevis } from "@/lib/devis/constants";
import { chargerDevisAEtablir } from "@/lib/bi/devis-a-etablir";
import type { Site } from "@/lib/types";

const COLONNES: ColonneTableur[] = [
  { titre: "Statut" },
  { titre: "Date devis" },
  { titre: "Nature" },
  { titre: "Numéro" },
  { titre: "Libellé" },
  { titre: "Montant", droite: true, largeur: "110px" },
  { titre: "Date commande client" },
  { titre: "Mois facturation" },
];

const STATUTS_REALISE_BI = new Set<string>(Object.values(Statuts).filter((s) => s !== Statuts.brouillon));

export default async function DevisClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: site }, { data: devisData }, { data: bons }, aEtablir] = await Promise.all([
    supabase.from("sites_view").select("id, nom, site, hors_contrat").eq("id", id).single(),
    supabase
      .from("devis")
      .select("id, numero, libelle, montant, date_devis, nature, date_commande_client, mois_facturation, bi_reference_historique, annule")
      .eq("site_id", id),
    supabase.from("bons_intervention").select("devis_id, statut").eq("site_id", id).not("devis_id", "is", null),
    chargerDevisAEtablir([id]),
  ]);
  if (!site) notFound();
  const s = site as Site;

  const devisRealises = new Set(
    (bons ?? []).filter((b) => b.devis_id && STATUTS_REALISE_BI.has(b.statut)).map((b) => b.devis_id as string),
  );

  type Ligne = {
    statut: string;
    dateDevis: string;
    nature: string;
    numero: string;
    libelle: string;
    montant: number | null;
    dateCommande: string;
    moisFacturation: string;
    href: string;
  };

  const lignes: Ligne[] = [];

  for (const d of devisData ?? []) {
    if (d.annule) continue;
    const realise = devisRealises.has(d.id) || Boolean(d.bi_reference_historique);
    const statut = realise ? "Réalisé" : d.date_commande_client ? "À réaliser" : "Envoyé";
    lignes.push({
      statut,
      dateDevis: formaterDate(d.date_devis),
      nature: labelNatureDevis(d.nature),
      numero: d.numero || "(sans référence)",
      libelle: d.libelle,
      montant: d.montant,
      dateCommande: formaterDate(d.date_commande_client),
      moisFacturation: d.mois_facturation,
      href: `/devis/${d.id}/statut`,
    });
  }
  for (const a of aEtablir) {
    lignes.push({
      statut: "À établir",
      dateDevis: "",
      nature: "",
      numero: a.biNumero,
      libelle: a.equipementNom,
      montant: null,
      dateCommande: "",
      moisFacturation: "",
      href: `/devis/nouveau?equipementId=${a.equipementId}&compteRendu=${encodeURIComponent(a.compteRendu)}`,
    });
  }

  return (
    <div>
      <FilAjouter
        maillons={[
          { nom: s.nom, href: `/repertoire/clients/groupe/${encodeURIComponent(s.nom)}?horsContrat=${s.hors_contrat ? 1 : 0}` },
          { nom: s.site || "Site sans nom", href: `/repertoire/clients/${id}` },
          { nom: "Devis" },
        ]}
      />
      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Devis</h1>
        <p className="text-sm text-slate-500">{[s.nom, s.site].filter(Boolean).join(" — ")} — {lignes.length} devis</p>
      </div>
      <Tableur
        colonnes={COLONNES}
        lignes={lignes.map((l) => [
          l.statut,
          l.dateDevis,
          l.nature,
          <Link key="numero" href={l.href} className="font-bold text-slate-900 hover:underline">
            {l.numero}
          </Link>,
          l.libelle,
          l.montant !== null ? eur(l.montant) : "",
          l.dateCommande,
          l.moisFacturation,
        ])}
        valeurs={lignes.map((l) => [l.statut, l.dateDevis, l.nature, l.numero, l.libelle, null, l.dateCommande, l.moisFacturation])}
        vide="Aucun devis pour ce site"
      />
    </div>
  );
}
